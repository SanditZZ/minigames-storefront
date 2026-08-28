// CALCULATIONS: text in, a grid of dark/light modules out.
//
// Two encoders live here, sharing one symbol-layout implementation:
//
// - `encode` — version 1 at error-correction level H, alphanumeric mode only.
//   Scope is deliberately narrow: a 21x21 symbol holding up to ten characters,
//   chosen to fit the thing this repo has always encoded with it — an
//   eight-character claim code (`internal/id`, whose confusable-free alphabet
//   is a subset of QR's alphanumeric charset). Untouched by the byte-mode
//   addition below; every existing caller keeps its exact output.
// - `encodeText` — versions 1 through 6 at level M, byte mode, for payloads
//   `encode` cannot hold: mixed case and a wider charset (a store's own
//   display URL, for the admin's TV/kiosk link — see `packages/admin-core`'s
//   `displayUrlFor`). Byte mode costs more bits per character than alphanumeric
//   packing, and level M trades some of `encode`'s error correction for
//   capacity — the right trade here, since a URL is read by a phone camera at
//   arm's length, not printed on a counter for a thumb to cover.
//
// The two share `blank`/`functionModules`/`paintFunctionPatterns`/
// `placeCodewords`/`applyMask`/`drawFormatBits`/`penalty`, all parameterised on
// `size` (and, where an alignment pattern exists, its centre) rather than
// closing over a fixed version's constants. Versions 1-6 each have AT MOST one
// alignment pattern away from the finders (spec Annex E gives exactly two
// candidate coordinates, {6, X}, for these versions, and only the (X,X)
// combination avoids every finder), which is what keeps that part of the
// extension small: no version needs the multi-pattern grid or the
// version-information area that only versions 7+ require.
//
// Extension points a payload past version 6 would still need: the alignment
// coordinate table beyond version 6 (more than one pattern per symbol), the
// version-information area (versions 7+), and ragged (unequally sized)
// error-correction blocks — versions 1-6 at level M happen to split evenly, so
// `splitBlocks` below never had to handle the uneven case the spec allows.

import { remainder } from "./gf";

/** A square grid of modules. `true` is dark. Row-major: `modules[row][col]`. */
export interface QrCode {
	/** Modules per side, quiet zone NOT included. */
	readonly size: number;
	readonly modules: readonly boolean[][];
}

/** QR's alphanumeric charset. Index in this string IS the character's value. */
export const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const MODE_ALPHANUMERIC = 0b0010;
const MODE_BYTE = 0b0100;
const COUNT_BITS_ALPHANUMERIC = 9; // character-count field width, versions 1-9 alphanumeric
const COUNT_BITS_BYTE = 8; // character-count field width, versions 1-9 byte mode
const PAD_CODEWORDS = [0xec, 0x11]; // the spec's alternating filler
const EC_LEVEL_H = 0b10;
const EC_LEVEL_M = 0b00;

// --- encode(): version 1, level H, alphanumeric ------------------------------

const V1_SIZE = 21; // 4 * 1 + 17
const V1_DATA_CODEWORDS = 9;
const V1_EC_CODEWORDS = 17; // 26 total - 9 data

/** The most characters `encode` can hold. Derived, not asserted: */
export const MAX_LENGTH = maxLength();

function maxLength(): number {
	const budget = V1_DATA_CODEWORDS * 8 - 4 - COUNT_BITS_ALPHANUMERIC;
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

	const data = alphanumericCodewords(value);
	const ec = remainder(data, V1_EC_CODEWORDS);
	// Version 1 has a single block, so "interleaving" is concatenation. This is
	// the line that becomes real work at version 3 and above.
	const all = [...data, ...ec];

	return buildSymbol(V1_SIZE, null, EC_LEVEL_H, all);
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

/** The data codewords: mode, length, the characters, terminator and padding. */
function alphanumericCodewords(text: string): number[] {
	const bits: number[] = [];
	pushBits(bits, MODE_ALPHANUMERIC, 4);
	pushBits(bits, text.length, COUNT_BITS_ALPHANUMERIC);

	// Alphanumeric mode packs character PAIRS into 11 bits (45 * first + second),
	// which is what makes an 8-character code fit a version 1 symbol at level H.
	for (let i = 0; i + 1 < text.length; i += 2) {
		pushBits(bits, alphanumericValue(text[i]) * 45 + alphanumericValue(text[i + 1]), 11);
	}
	if (text.length % 2 === 1) {
		pushBits(bits, alphanumericValue(text[text.length - 1]), 6);
	}

	return padToCodewords(bits, V1_DATA_CODEWORDS);
}

function alphanumericValue(ch: string): number {
	return ALPHANUMERIC.indexOf(ch);
}

// --- encodeText(): versions 1-6, level M, byte mode --------------------------

/** One QR version's capacity and layout, for level M only. */
interface VersionSpec {
	readonly version: number;
	readonly size: number; // 4 * version + 17
	/** Total data codewords across every block, before error correction. */
	readonly dataCodewords: number;
	readonly ecCodewordsPerBlock: number;
	readonly numBlocks: number;
	/** Row/column of the symbol's one non-finder alignment pattern, or null (version 1 has none). */
	readonly alignmentCenter: number | null;
	/** Bytes `encodeText` can fit at this version: derived from `dataCodewords`, the 4-bit mode field and the 8-bit byte-mode length field. */
	readonly maxBytes: number;
}

/**
 * Versions 1-6 at error-correction level M (ISO/IEC 18004 tables 7 and 9).
 * `dataCodewords` splits EVENLY across `numBlocks` for every version in this
 * range (32+32 at v4, 43+43 at v5, 27*4 at v6) — the reason `splitBlocks`
 * below can be a plain division instead of the spec's general uneven-group
 * case.
 */
const VERSIONS: readonly VersionSpec[] = [
	{ version: 1, size: 21, dataCodewords: 16, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenter: null, maxBytes: 14 },
	{ version: 2, size: 25, dataCodewords: 28, ecCodewordsPerBlock: 16, numBlocks: 1, alignmentCenter: 18, maxBytes: 26 },
	{ version: 3, size: 29, dataCodewords: 44, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenter: 22, maxBytes: 42 },
	{ version: 4, size: 33, dataCodewords: 64, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenter: 26, maxBytes: 62 },
	{ version: 5, size: 37, dataCodewords: 86, ecCodewordsPerBlock: 24, numBlocks: 2, alignmentCenter: 30, maxBytes: 84 },
	{ version: 6, size: 41, dataCodewords: 108, ecCodewordsPerBlock: 16, numBlocks: 4, alignmentCenter: 34, maxBytes: 106 },
];

/** The most bytes `encodeText` can hold, at its largest supported version. */
export const MAX_TEXT_BYTES = VERSIONS[VERSIONS.length - 1].maxBytes;

/** UTF-8 bytes of `text`. A display URL is ASCII, but this stays correct for anything else routed through here. */
function utf8Bytes(text: string): number[] {
	return Array.from(new TextEncoder().encode(text));
}

/** Whether `text` fits some supported version — the byte-mode counterpart of `canEncode`. */
export function canEncodeText(text: string): boolean {
	const bytes = utf8Bytes(text);
	return bytes.length > 0 && bytes.length <= MAX_TEXT_BYTES;
}

/**
 * Encodes arbitrary text (byte mode) as a QR symbol at the smallest of
 * versions 1-6 that fits it, or null when even version 6 cannot — same
 * null-rather-than-throw contract as `encode`, for the same reason: a caller
 * that shows the value as plain text beside the code should lose only the
 * scannable form, not the value.
 */
export function encodeText(text: string): QrCode | null {
	const bytes = utf8Bytes(text);
	if (bytes.length === 0) return null;
	const spec = VERSIONS.find((v) => bytes.length <= v.maxBytes);
	if (!spec) return null;

	const data = byteCodewords(bytes, spec.dataCodewords);
	const dataBlocks = splitBlocks(data, spec.numBlocks);
	const ecBlocks = dataBlocks.map((block) => remainder(block, spec.ecCodewordsPerBlock));
	const all = [...interleave(dataBlocks), ...interleave(ecBlocks)];

	return buildSymbol(spec.size, spec.alignmentCenter, EC_LEVEL_M, all);
}

/** The data codewords for byte mode: mode, length, the raw bytes, terminator and padding. */
function byteCodewords(bytes: readonly number[], dataCodewords: number): number[] {
	const bits: number[] = [];
	pushBits(bits, MODE_BYTE, 4);
	pushBits(bits, bytes.length, COUNT_BITS_BYTE);
	for (const b of bytes) pushBits(bits, b, 8);

	return padToCodewords(bits, dataCodewords);
}

/** Splits `data` into `numBlocks` equal-sized error-correction blocks. */
function splitBlocks(data: readonly number[], numBlocks: number): number[][] {
	const perBlock = data.length / numBlocks;
	const blocks: number[][] = [];
	for (let i = 0; i < numBlocks; i++) blocks.push(data.slice(i * perBlock, (i + 1) * perBlock));
	return blocks;
}

/**
 * The spec's block interleaving: byte 0 of every block, then byte 1 of every
 * block, and so on. Works for ragged blocks too (a shorter block just stops
 * contributing), even though every version this file supports happens to
 * split evenly — see the comment on `VERSIONS`.
 */
function interleave(blocks: readonly (readonly number[])[]): number[] {
	const out: number[] = [];
	const maxLen = Math.max(...blocks.map((b) => b.length));
	for (let i = 0; i < maxLen; i++) {
		for (const b of blocks) if (i < b.length) out.push(b[i]);
	}
	return out;
}

// --- shared bit-stream helpers ------------------------------------------------

/** Terminator (up to 4 bits), pads to a byte boundary, then fills with the spec's alternating filler bytes. */
function padToCodewords(bits: number[], dataCodewords: number): number[] {
	const capacity = dataCodewords * 8;
	for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
	while (bits.length % 8 !== 0) bits.push(0);

	const out: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		let byte = 0;
		for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
		out.push(byte);
	}
	// Filler alternates 0xEC, 0x11 counting from the FIRST pad byte, not from the
	// start of the block, so it is indexed by how many pads have been added.
	for (let pad = 0; out.length < dataCodewords; pad++) {
		out.push(PAD_CODEWORDS[pad % 2]);
	}
	return out;
}

function pushBits(bits: number[], value: number, width: number): void {
	for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

// --- symbol layout (shared by both encoders) ---------------------------------

/**
 * Lays a fully assembled, interleaved codeword sequence into a symbol of the
 * given size, picks the lowest-penalty mask, and returns it. The one piece of
 * per-version knowledge left outside this function is which codewords to pass
 * in and which alignment pattern (if any) to draw — everything else about a
 * version 1-6 symbol's structure follows from `size` and `alignmentCenter`.
 */
function buildSymbol(size: number, alignmentCenter: number | null, ecLevelBits: number, codewords: number[]): QrCode {
	const fixed = functionModules(size, alignmentCenter);
	const modules = blank(size);
	paintFunctionPatterns(modules, size, alignmentCenter);
	placeCodewords(modules, fixed, codewords, size);

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
		applyMask(candidate, fixed, mask, size);
		drawFormatBits(candidate, mask, size, ecLevelBits);
		const score = penalty(candidate);
		if (score < bestPenalty) {
			bestPenalty = score;
			best = candidate;
		}
	}

	return { size, modules: best };
}

function blank(size: number): boolean[][] {
	return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function clone(m: boolean[][]): boolean[][] {
	return m.map((row) => [...row]);
}

/**
 * Which cells belong to the symbol's structure rather than to the message:
 * finders, their separators, the timing patterns, the dark module, the two
 * format-information strips, and — for versions 2+ — the one alignment
 * pattern.
 *
 * Marked BEFORE anything is drawn, because it is what both the data placement
 * and the mask have to skip. Getting this set wrong is the classic QR bug: the
 * symbol looks right and no scanner can read it.
 */
function functionModules(size: number, alignmentCenter: number | null): boolean[][] {
	const fixed = blank(size);
	const mark = (row: number, col: number) => {
		if (row >= 0 && row < size && col >= 0 && col < size) fixed[row][col] = true;
	};

	// Finder patterns plus their one-module separators: an 8x8 corner each.
	for (const [top, left] of [
		[0, 0],
		[0, size - 8],
		[size - 8, 0],
	]) {
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) mark(top + r, left + c);
		}
	}

	// Timing patterns: the full row 6 and column 6.
	for (let i = 0; i < size; i++) {
		mark(6, i);
		mark(i, 6);
	}

	// Format information, both copies, and the always-dark module.
	for (let i = 0; i < 9; i++) {
		mark(8, i);
		mark(i, 8);
	}
	for (let i = 0; i < 8; i++) mark(8, size - 1 - i);
	for (let i = 0; i < 7; i++) mark(size - 1 - i, 8);

	if (alignmentCenter !== null) {
		for (let r = -2; r <= 2; r++) {
			for (let c = -2; c <= 2; c++) mark(alignmentCenter + r, alignmentCenter + c);
		}
	}

	return fixed;
}

function paintFunctionPatterns(modules: boolean[][], size: number, alignmentCenter: number | null): void {
	// Finder pattern: a 7x7 dark ring, a light ring inside it, a 3x3 dark core.
	for (const [top, left] of [
		[0, 0],
		[0, size - 7],
		[size - 7, 0],
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
	for (let i = 8; i < size - 8; i++) {
		const dark = i % 2 === 0;
		modules[6][i] = dark;
		modules[i][6] = dark;
	}

	// The dark module. Its position is (size - 8, 8) at every version this file
	// supports — algebraically `4 * version + 9`, since `size = 4 * version +
	// 17` — so no version-specific case is needed here.
	modules[size - 8][8] = true;

	// The alignment pattern: a smaller finder-shaped mark (5x5 dark ring, light
	// ring, dark centre) at the symbol's one non-finder-adjacent alignment
	// coordinate. Versions past 6 need more than one of these, in a grid this
	// file does not attempt.
	if (alignmentCenter !== null) {
		for (let r = -2; r <= 2; r++) {
			for (let c = -2; c <= 2; c++) {
				const ring = Math.max(Math.abs(r), Math.abs(c));
				modules[alignmentCenter + r][alignmentCenter + c] = ring !== 1;
			}
		}
	}
}

/**
 * Writes the codewords in the spec's zigzag: two-module-wide columns, right to
 * left, alternating upward and downward, skipping structure and the vertical
 * timing pattern.
 */
function placeCodewords(modules: boolean[][], fixed: boolean[][], data: readonly number[], size: number): void {
	let bit = 0;
	const total = data.length * 8;

	for (let right = size - 1; right >= 1; right -= 2) {
		// Column 6 is the timing pattern; the pair shifts left rather than
		// straddling it.
		if (right === 6) right = 5;
		for (let vert = 0; vert < size; vert++) {
			for (let j = 0; j < 2; j++) {
				const col = right - j;
				// Direction comes from the column index rather than a toggle, so the
				// skip above cannot desynchronise it.
				const upward = ((right + 1) & 2) === 0;
				const row = upward ? size - 1 - vert : vert;
				if (!fixed[row][col] && bit < total) {
					modules[row][col] = ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
					bit++;
				}
			}
		}
	}
}

/** Inverts data modules where the mask condition holds. Structure is untouched. */
function applyMask(modules: boolean[][], fixed: boolean[][], mask: number, size: number): void {
	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; col++) {
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
function drawFormatBits(modules: boolean[][], mask: number, size: number, ecLevelBits: number): void {
	const data = (ecLevelBits << 3) | mask;
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
	for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = at(i);
	for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = at(i);

	modules[size - 8][8] = true; // the dark module, restated after masking
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
	const size = modules.length;
	let score = 0;

	// Rule 1: long same-coloured runs, both directions.
	for (let i = 0; i < size; i++) {
		score += runPenalty(modules[i]);
		score += runPenalty(modules.map((row) => row[i]));
	}

	// Rule 2: 2x2 blocks of a single colour.
	for (let row = 0; row < size - 1; row++) {
		for (let col = 0; col < size - 1; col++) {
			const v = modules[row][col];
			if (v === modules[row][col + 1] && v === modules[row + 1][col] && v === modules[row + 1][col + 1]) {
				score += N2;
			}
		}
	}

	// Rule 3: the 1:1:3:1:1 finder ratio appearing in the data, with four light
	// modules on either side — the pattern a scanner uses to locate the symbol,
	// so a copy of it inside the payload is actively misleading.
	for (let i = 0; i < size; i++) {
		score += finderLikePenalty(modules[i]);
		score += finderLikePenalty(modules.map((row) => row[i]));
	}

	// Rule 4: how far the dark proportion strays from half.
	let dark = 0;
	for (const row of modules) for (const cell of row) if (cell) dark++;
	const total = size * size;
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

// --- rendering ----------------------------------------------------------------

/**
 * An SVG path covering every dark module, as one `d` attribute.
 *
 * One path rather than a rect per module: a symbol can be up to 441 elements
 * even at version 1, and a claim card renders this beside an image and a copy
 * button on a phone. The coordinate system is one unit per module, so the
 * caller scales with a `viewBox` and never has to recompute geometry for a
 * different size.
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
