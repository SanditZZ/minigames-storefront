import type { Page } from "@playwright/test";

/**
 * The narrowest screen worth supporting.
 *
 * 320px is an iPhone SE in portrait and the floor the project's spacing rules
 * are written against. The suite runs everything else at Pixel 7 width (412px),
 * which is wide enough to hide the failures this width exists to catch.
 */
export const NARROW_VIEWPORT = { width: 320, height: 640 };

/** An element that is wider than the viewport, named well enough to find it. */
export interface Overflow {
  /** How far past the viewport's right edge the document extends, in px. */
  documentPx: number;
  /** The widest offender, as a CSS-ish description, or "" when nothing overflows. */
  worst: string;
}

/**
 * Measures horizontal overflow: the failure a narrow screen produces and a DOM
 * assertion otherwise misses entirely.
 *
 * Why this is worth a helper rather than one `scrollWidth` comparison inline:
 * the document-level number says only THAT something is too wide, and a spec
 * that fails with "0 !== 43" sends the next person to read the whole page. So
 * this also walks the elements and names the widest offender, which is the
 * fact that actually shortens the fix.
 *
 * Elements that scroll on purpose are skipped — a wide table or code block
 * inside its own `overflow-x: auto` container is the CORRECT way to carry
 * content too wide to fit, and flagging it would train everyone to ignore this.
 */
export async function horizontalOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const limit = doc.clientWidth;

    let worst = "";
    let worstWidth = limit;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const box = el.getBoundingClientRect();
      // `right` rather than `width`: an element narrower than the screen still
      // overflows if it starts far enough to the right, which is what a long
      // unbroken string next to a sibling actually does.
      if (box.right <= limit + 1) continue;

      // Its own scroller, or inside one: the content is meant to be pannable.
      let scrollable = false;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") {
          scrollable = true;
          break;
        }
      }
      if (scrollable) continue;

      if (box.right > worstWidth) {
        worstWidth = box.right;
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
        worst = `${el.tagName.toLowerCase()}${id}${cls} → right edge ${Math.round(box.right)}px of ${limit}px, text: ${JSON.stringify((el.textContent ?? "").trim().slice(0, 40))}`;
      }
    }

    return { documentPx: Math.max(0, doc.scrollWidth - limit), worst };
  });
}
