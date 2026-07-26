// CALCULATIONS: text in, a grid of dark/light modules out.
//
// Scope is deliberate and narrow: **one QR version (1) at one error-correction
// level (H), in alphanumeric mode.** That is a 21x21 symbol holding up to ten
// characters of `ALPHANUMERIC` below, and it is chosen to fit the thing this repo
// actually encodes — an eight-character claim code (`internal/id`, whose
// confusable-free alphabet is a subset of QR's alphanumeric charset).
//
// Why not a general encoder: every step past version 1 adds machinery that a
// claim code will never exercise — alignment patterns from version 2, multiple
// error-correction blocks with interleaving from version 3, a version-information
// area from version 7, and a capacity table for all forty. Level H is the
// highest error correction available, which is the right trade when the payload
// is this small: the spare capacity has nothing better to do than survive a
// thumb, a fold, or a scratched counter screen.
//
// If a future feature needs more (a deep link into the admin is the obvious one —
// see docs/potential-features.md, where it is a security question before it is a
// capacity one), the extension points are: a version/EC capacity table, the
// alignment-pattern positions, and block splitting in `codewords`. Everything
// else here is version-agnostic already.

import { remainder } from "./gf";

/** A square grid of modules. `true` is dark. Row-major: `modules[row][col]`. */
export interface QrCode {
	/** Modules per side, quiet zone NOT included. */
	readonly size: number;
	readonly modules: readonly boolean[][];
}

/** QR's alphanumeric charset. Index in this string IS the character's value. */
export const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const VERSION = 1;
const SIZE = 21; // 4 * VERSION + 17
const DATA_CODEWORDS = 9; // version 1, level H
const EC_CODEWORDS = 17; // 26 total - 9 data
const MODE_ALPHANUMERIC = 0b0010;
const COUNT_BITS = 9; // character-count field width, versions 1-9 alphanumeric
const EC_LEVEL_BITS = 0b10; // H
const PAD_CODEWORDS = [0xec, 0x11]; // the spec's alternating filler

/** The most characters this symbol can hold. Derived, not asserted: */
export const MAX_LENGTH = maxLength();

function maxLength(): number {
	const budget = DATA_CODEWORDS * 8 - 4 - COUNT_BITS;
	// Pairs cost 11 bits, a trailing single costs 6.
	const pairs = Math.floor(budget / 11);
	return pairs * 2 + (budget - pairs * 11 >= 6 ? 1 : 0);
}

/**
 * Encodes `text` as a QR symbol, or returns null when it cannot.
 *
 * Null rather than a throw, because the one caller that matters — the player's
 * claim card — shows the code as text beside the QR. A code that somehow could
 * not be encoded should cost the player a convenience, not the screen they are
 * standing at a counter holding. Callers that would rather fail loudly can check
 * `canEncode` first.
 *
 * Input is upper-cased before validation: `abcd2345` and `ABCD2345` are the same
 * claim code (see id.NormalizeClaimCode in Go), and refusing the lowercase form
 * would make this stricter than the endpoint it feeds.
 */
export function encode(text: string): QrCode | null {
	const value = text.toUpperCase();
	if (!canEncode(value)) return null;

	const data = codewords(value);
	const ec = remainder(data, EC_CODEWORDS);
	// Version 1 has a single block, so "interleaving" is concatenation. This is
	// the line that becomes real work at version 3 and above.
	const all = [...data, ...ec];

	const fixed = functionModules();
	const modules = blank();
	paintFunctionPatterns(modules);
	placeCodewords(modules, fixed, all);

	// The spec picks the mask with the lowest penalty rather than a fixed one:
	// large uniform areas and finder-lookalikes inside the data are what make a
	// symbol slow or impossible to acquire, and which mask avoids them depends
	// entirely on the payload.
	// The chosen mask needs no return value: drawFormatBits records it INSIDE the
	// symbol, which is how a scanner knows what to undo.
	let best = modules;
	let bestPenalty = Infinity;
	for (let mask = 0; mask < 8; mask++) {
		const candidate = clone(modules);
		applyMask(candidate, fixed, mask);
		drawFormatBits(candidate, mask);
		const score = penalty(candidate);
		if (score < bestPenalty) {
			bestPenalty = score;
			best = candidate;
		}
	}

	return { size: SIZE, modules: best };
}

/** Whether `text` fits this symbol: charset and length both. */
export function canEncode(text: string): boolean {
	const value = text.toUpperCase();
	if (value.length === 0 || value.length > MAX_LENGTH) return false;
	for (const ch of value) {
		if (!ALPHANUMERIC.includes(ch)) return false;
	}
	return true;
}

/**
 * An SVG path covering every dark module, as one `d` attribute.
 *
 * One path rather than a rect per module: a 21x21 symbol is up to 441 elements,
 * and a claim card renders this beside an image and a copy button on a phone.
 * The coordinate system is one unit per module, so the caller scales with a
 * `viewBox` and never has to recompute geometry for a different size.
 *
 * `quietZone` is in modules and defaults to the spec's 4. It is part of the
 * symbol, not decoration: without it a scanner has no edge to lock onto, which
 * is exactly the failure that looks like "the camera just won't read it".
 */
export function toSvgPath(qr: QrCode, quietZone = 4): string {
	const parts: string[] = [];
	for (let row = 0; row < qr.size; row++) {
		for (let col = 0; col < qr.size; col++) {
			if (qr.modules[row][col]) {
				parts.push(`M${col + quietZone} ${row + quietZone}h1v1h-1z`);
			}
		}
	}
	return parts.join("");
}

/** The side length a `toSvgPath` viewBox needs, quiet zone included. */
export function svgExtent(qr: QrCode, quietZone = 4): number {
	return qr.size + quietZone * 2;
}

// --- bit stream -------------------------------------------------------------

/** The data codewords: mode, length, the characters, terminator and padding. */
function codewords(text: string): number[] {
	const bits: number[] = [];
	pushBits(bits, MODE_ALPHANUMERIC, 4);
	pushBits(bits, text.length, COUNT_BITS);

	// Alphanumeric mode packs character PAIRS into 11 bits (45 * first + second),
	// which is what makes an 8-character code fit a version 1 symbol at level H.
	for (let i = 0; i + 1 < text.length; i += 2) {
		pushBits(bits, value(text[i]) * 45 + value(text[i + 1]), 11);
	}
	if (text.length % 2 === 1) {
		pushBits(bits, value(text[text.length - 1]), 6);
	}

	const capacity = DATA_CODEWORDS * 8;
	// Terminator, truncated if the payload ends flush against capacity.
	for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
	// Then to a byte boundary, then filler bytes until the block is full.
	while (bits.length % 8 !== 0) bits.push(0);

	const out: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		let byte = 0;
		for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
		out.push(byte);
	}
	// Filler alternates 0xEC, 0x11 counting from the FIRST pad byte, not from the
	// start of the block, so it is indexed by how many pads have been added.
	for (let pad = 0; out.length < DATA_CODEWORDS; pad++) {
		out.push(PAD_CODEWORDS[pad % 2]);
	}
	return out;
}

function value(ch: string): number {
	return ALPHANUMERIC.indexOf(ch);
}

function pushBits(bits: number[], value: number, width: number): void {
	for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

// --- symbol layout ----------------------------------------------------------

function blank(): boolean[][] {
	return Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
}

function clone(m: boolean[][]): boolean[][] {
	return m.map((row) => [...row]);
}

/**
 * Which cells belong to the symbol's structure rather than to the message:
 * finders, their separators, the timing patterns, the dark module and the two
 * format-information strips.
 *
 * Marked BEFORE anything is drawn, because it is what both the data placement
 * and the mask have to skip. Getting this set wrong is the classic QR bug: the
 * symbol looks right and no scanner can read it.
 */
function functionModules(): boolean[][] {
	const fixed = blank();
	const mark = (row: number, col: number) => {
		if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) fixed[row][col] = true;
	};

	// Finder patterns plus their one-module separators: an 8x8 corner each.
	for (const [top, left] of [
		[0, 0],
		[0, SIZE - 8],
		[SIZE - 8, 0],
	]) {
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) mark(top + r, left + c);
		}
	}

	// Timing patterns: the full row 6 and column 6.
	for (let i = 0; i < SIZE; i++) {
		mark(6, i);
		mark(i, 6);
	}

	// Format information, both copies, and the always-dark module.
	for (let i = 0; i < 9; i++) {
		mark(8, i);
		mark(i, 8);
	}
	for (let i = 0; i < 8; i++) mark(8, SIZE - 1 - i);
	for (let i = 0; i < 7; i++) mark(SIZE - 1 - i, 8);

	return fixed;
}

function paintFunctionPatterns(modules: boolean[][]): void {
	// Finder pattern: a 7x7 dark ring, a light ring inside it, a 3x3 dark core.
	for (const [top, left] of [
		[0, 0],
		[0, SIZE - 7],
		[SIZE - 7, 0],
	]) {
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 7; c++) {
				const ring = r === 0 || r === 6 || c === 0 || c === 6;
				const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
				modules[top + r][left + c] = ring || core;
			}
		}
	}

	// Timing: alternating, dark on even coordinates. The finders already fix the
	// ends, so only the span between them is written here.
	for (let i = 8; i < SIZE - 8; i++) {
		const dark = i % 2 === 0;
		modules[6][i] = dark;
		modules[i][6] = dark;
	}

	// The dark module. Its position is a function of the version and it is the
	// one module whose value never depends on anything.
	modules[4 * VERSION + 9][8] = true;
}

/**
 * Writes the codewords in the spec's zigzag: two-module-wide columns, right to
 * left, alternating upward and downward, skipping structure and the vertical
 * timing pattern.
 */
function placeCodewords(modules: boolean[][], fixed: boolean[][], data: readonly number[]): void {
	let bit = 0;
	const total = data.length * 8;

	for (let right = SIZE - 1; right >= 1; right -= 2) {
		// Column 6 is the timing pattern; the pair shifts left rather than
		// straddling it.
		if (right === 6) right = 5;
		for (let vert = 0; vert < SIZE; vert++) {
			for (let j = 0; j < 2; j++) {
				const col = right - j;
				// Direction comes from the column index rather than a toggle, so the
				// skip above cannot desynchronise it.
				const upward = ((right + 1) & 2) === 0;
				const row = upward ? SIZE - 1 - vert : vert;
				if (!fixed[row][col] && bit < total) {
					modules[row][col] = ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
					bit++;
				}
			}
		}
	}
}

/** Inverts data modules where the mask condition holds. Structure is untouched. */
function applyMask(modules: boolean[][], fixed: boolean[][], mask: number): void {
	for (let row = 0; row < SIZE; row++) {
		for (let col = 0; col < SIZE; col++) {
			if (fixed[row][col]) continue;
			if (maskCondition(mask, row, col)) modules[row][col] = !modules[row][col];
		}
	}
}

function maskCondition(mask: number, row: number, col: number): boolean {
	switch (mask) {
		case 0:
			return (row + col) % 2 === 0;
		case 1:
			return row % 2 === 0;
		case 2:
			return col % 3 === 0;
		case 3:
			return (row + col) % 3 === 0;
		case 4:
			return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
		case 5:
			return ((row * col) % 2) + ((row * col) % 3) === 0;
		case 6:
			return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
		default:
			return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
	}
}

/**
 * Writes the 15-bit format information: error-correction level, mask id, and a
 * BCH(15,5) code over the two, XORed with the spec's 0x5412.
 *
 * It goes in twice, in two corners, so a symbol with one corner damaged can
 * still be read at all — a scanner that cannot recover these bits does not know
 * which mask to undo and gets nothing.
 */
function drawFormatBits(modules: boolean[][], mask: number): void {
	const data = (EC_LEVEL_BITS << 3) | mask;
	let rem = data;
	for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
	const bits = ((data << 10) | rem) ^ 0x5412;

	const at = (i: number) => ((bits >>> i) & 1) === 1;

	// First copy, wrapping the top-left finder.
	for (let i = 0; i <= 5; i++) modules[i][8] = at(i);
	modules[7][8] = at(6);
	modules[8][8] = at(7);
	modules[8][7] = at(8);
	for (let i = 9; i < 15; i++) modules[8][14 - i] = at(i);

	// Second copy, split between the other two finders.
	for (let i = 0; i < 8; i++) modules[8][SIZE - 1 - i] = at(i);
	for (let i = 8; i < 15; i++) modules[SIZE - 15 + i][8] = at(i);

	modules[SIZE - 8][8] = true; // the dark module, restated after masking
}

// --- mask scoring -----------------------------------------------------------

const N1 = 3; // a run of five or more same-coloured modules
const N2 = 3; // a 2x2 block of one colour
const N3 = 40; // a finder-lookalike inside the data
const N4 = 10; // an unbalanced ratio of dark to light

/**
 * The spec's penalty score. Lower is better; the four rules each describe
 * something that makes a symbol harder for a camera to resolve.
 */
export function penalty(modules: readonly boolean[][]): number {
	let score = 0;

	// Rule 1: long same-coloured runs, both directions.
	for (let i = 0; i < SIZE; i++) {
		score += runPenalty(modules[i]);
		score += runPenalty(modules.map((row) => row[i]));
	}

	// Rule 2: 2x2 blocks of a single colour.
	for (let row = 0; row < SIZE - 1; row++) {
		for (let col = 0; col < SIZE - 1; col++) {
			const v = modules[row][col];
			if (v === modules[row][col + 1] && v === modules[row + 1][col] && v === modules[row + 1][col + 1]) {
				score += N2;
			}
		}
	}

	// Rule 3: the 1:1:3:1:1 finder ratio appearing in the data, with four light
	// modules on either side — the pattern a scanner uses to locate the symbol,
	// so a copy of it inside the payload is actively misleading.
	for (let i = 0; i < SIZE; i++) {
		score += finderLikePenalty(modules[i]);
		score += finderLikePenalty(modules.map((row) => row[i]));
	}

	// Rule 4: how far the dark proportion strays from half.
	let dark = 0;
	for (const row of modules) for (const cell of row) if (cell) dark++;
	const total = SIZE * SIZE;
	const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
	score += Math.max(0, k) * N4;

	return score;
}

function runPenalty(line: readonly boolean[]): number {
	let score = 0;
	let run = 1;
	for (let i = 1; i < line.length; i++) {
		if (line[i] === line[i - 1]) {
			run++;
			continue;
		}
		if (run >= 5) score += N1 + (run - 5);
		run = 1;
	}
	if (run >= 5) score += N1 + (run - 5);
	return score;
}

const FINDER = [true, false, true, true, true, false, true];
const LIGHT4 = [false, false, false, false];

function finderLikePenalty(line: readonly boolean[]): number {
	let score = 0;
	for (let i = 0; i + FINDER.length <= line.length; i++) {
		if (!matches(line, i, FINDER)) continue;
		const before = matches(line, i - LIGHT4.length, LIGHT4);
		const after = matches(line, i + FINDER.length, LIGHT4);
		if (before || after) score += N3;
	}
	return score;
}

function matches(line: readonly boolean[], from: number, pattern: readonly boolean[]): boolean {
	if (from < 0 || from + pattern.length > line.length) return false;
	for (let i = 0; i < pattern.length; i++) {
		if (line[from + i] !== pattern[i]) return false;
	}
	return true;
}
