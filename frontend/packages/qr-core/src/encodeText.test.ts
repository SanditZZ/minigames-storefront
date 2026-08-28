import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { canEncodeText, encodeText, MAX_TEXT_BYTES, svgExtent, toSvgPath, type QrCode } from "./encode";

/**
 * Rasterises a symbol into the pixel buffer `jsQR` expects, and decodes it.
 *
 * This is the same idea as `e2e/tests/claim-qr.spec.ts`'s `decodeQr` — an
 * independent decoder is the only thing that can tell a genuinely correct
 * symbol from one that merely looks plausible — but rasterising the module
 * grid directly instead of screenshotting rendered SVG, so the check runs in
 * plain Node and covers every version/block-count combination in milliseconds
 * rather than one symbol per browser test. `claim-qr.spec.ts` still owns
 * proving the rendered `<svg>` itself is scannable.
 */
function decode(qr: QrCode): string | null {
	const quietZone = 4;
	const extent = svgExtent(qr, quietZone);
	const scale = 4; // pixels per module — comfortably above jsQR's resolving floor
	const px = extent * scale;

	const data = new Uint8ClampedArray(px * px * 4).fill(255); // start all white
	for (let row = 0; row < qr.size; row++) {
		for (let col = 0; col < qr.size; col++) {
			if (!qr.modules[row][col]) continue;
			const x0 = (col + quietZone) * scale;
			const y0 = (row + quietZone) * scale;
			for (let y = y0; y < y0 + scale; y++) {
				for (let x = x0; x < x0 + scale; x++) {
					const i = (y * px + x) * 4;
					data[i] = data[i + 1] = data[i + 2] = 0; // black
					data[i + 3] = 255;
				}
			}
		}
	}

	return jsQR(data, px, px)?.data ?? null;
}

describe("encodeText", () => {
	it("round-trips through an independent decoder at every supported version", () => {
		// One payload per version boundary: right at the previous version's
		// limit (forcing that version), and a couple of realistic display URLs.
		const cases = [
			"A", // version 1
			"x".repeat(14), // version 1's limit
			"x".repeat(15), // spills into version 2
			"x".repeat(26), // version 2's limit
			"x".repeat(27), // spills into version 3 — the first multi-alignment-free case above v2
			"http://100.64.124.94:3000/display/tap-fast", // a real display URL (44 bytes, version 4)
			"x".repeat(62), // version 4's limit
			"x".repeat(63), // spills into version 5
			"x".repeat(84), // version 5's limit
			"x".repeat(85), // spills into version 6 — exercises the 4-block interleaving
			"x".repeat(MAX_TEXT_BYTES), // version 6's limit
			"Mixed Case & Path/Segments-123:ok", // mixed case and symbols a URL actually has
		];

		for (const text of cases) {
			const qr = encodeText(text);
			expect(qr, text).not.toBeNull();
			expect(decode(qr!), text).toBe(text);
		}
	});

	it("picks the smallest version that fits", () => {
		expect(encodeText("A")?.size).toBe(21); // version 1
		expect(encodeText("x".repeat(15))?.size).toBe(25); // version 2
		expect(encodeText("x".repeat(27))?.size).toBe(29); // version 3
		expect(encodeText("x".repeat(43))?.size).toBe(33); // version 4
		expect(encodeText("x".repeat(63))?.size).toBe(37); // version 5
		expect(encodeText("x".repeat(85))?.size).toBe(41); // version 6
	});

	it("refuses what not even version 6 can hold, rather than truncating", () => {
		expect(canEncodeText("")).toBe(false);
		expect(canEncodeText("x".repeat(MAX_TEXT_BYTES + 1))).toBe(false);
		expect(encodeText("")).toBeNull();
		expect(encodeText("x".repeat(MAX_TEXT_BYTES + 1))).toBeNull();
	});

	it("preserves case and punctuation the alphanumeric encoder cannot", () => {
		const text = "http://Store.example/display/Tap-Fast";
		const qr = encodeText(text);
		expect(qr).not.toBeNull();
		expect(decode(qr!)).toBe(text); // NOT upper-cased, unlike encode()
	});
});

describe("svg output at a non-version-1 size", () => {
	it("still emits one sub-path per dark module", () => {
		const qr = encodeText("x".repeat(50)); // version 4
		expect(qr).not.toBeNull();
		const dark = qr!.modules.flat().filter(Boolean).length;
		const path = toSvgPath(qr!);
		expect(path.match(/M/g) ?? []).toHaveLength(dark);
	});
});
