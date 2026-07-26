// CALCULATIONS + derived DATA: arithmetic in GF(256), the field QR's
// Reed–Solomon error correction is defined over.
//
// Nothing here knows what a QR code is. It multiplies and divides polynomials
// whose coefficients are bytes, which is the only reason a scanner can read a
// code with a thumb over part of it.

/** QR's primitive polynomial, x^8 + x^4 + x^3 + x^2 + 1. Fixed by the spec. */
const PRIMITIVE = 0x11d;

/**
 * Exponent and logarithm tables for the field's generator (2).
 *
 * Built once at module load and never written again — derived DATA, not mutable
 * state. Multiplication in GF(256) is addition of logarithms, so these two
 * arrays are what turn an otherwise expensive operation into two lookups.
 */
const { exp, log } = buildTables();

function buildTables(): { exp: number[]; log: number[] } {
	const exp = new Array<number>(512).fill(0);
	const log = new Array<number>(256).fill(0);

	let x = 1;
	for (let i = 0; i < 255; i++) {
		exp[i] = x;
		log[x] = i;
		x <<= 1;
		// Overflowing 8 bits means reducing modulo the primitive polynomial, which
		// is what keeps every product inside the field.
		if (x & 0x100) x ^= PRIMITIVE;
	}
	// The tail repeats the cycle so a sum of two logs (max 254 + 254) can be
	// indexed without a modulo at every call site.
	for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];

	return { exp, log };
}

/** Multiplies two field elements. Zero absorbs, as in ordinary arithmetic. */
export function gfMul(a: number, b: number): number {
	if (a === 0 || b === 0) return 0;
	return exp[log[a] + log[b]];
}

/**
 * The generator polynomial for `ecCount` error-correction codewords: the product
 * of (x - a^0)(x - a^1)…, whose degree IS the number of codewords it produces.
 *
 * Returned highest-degree-coefficient-first, matching the message layout in
 * `remainder` below, so neither side has to reverse the other.
 */
export function generatorPoly(ecCount: number): number[] {
	let poly = [1];
	for (let i = 0; i < ecCount; i++) {
		poly = polyMul(poly, [1, exp[i]]);
	}
	return poly;
}

function polyMul(a: number[], b: number[]): number[] {
	const out = new Array<number>(a.length + b.length - 1).fill(0);
	for (let i = 0; i < a.length; i++) {
		for (let j = 0; j < b.length; j++) {
			out[i + j] ^= gfMul(a[i], b[j]);
		}
	}
	return out;
}

/**
 * The error-correction codewords for `data`: the remainder of dividing the
 * message (shifted left by `ecCount` places) by the generator polynomial.
 *
 * This is long division with XOR for subtraction. `data` is not mutated — the
 * caller's codewords are still needed to build the symbol.
 */
export function remainder(data: readonly number[], ecCount: number): number[] {
	const gen = generatorPoly(ecCount);
	const buf = [...data, ...new Array<number>(ecCount).fill(0)];

	for (let i = 0; i < data.length; i++) {
		const lead = buf[i];
		if (lead === 0) continue;
		for (let j = 0; j < gen.length; j++) {
			buf[i + j] ^= gfMul(gen[j], lead);
		}
	}

	return buf.slice(data.length);
}
