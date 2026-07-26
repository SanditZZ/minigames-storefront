// ACTIONS layer: the one module in the admin app that writes to the document's
// style, and the web half of the runtime palette.
//
// The admin wears the store's colours too, which is a deliberate choice rather
// than symmetry for its own sake: an operator picking a palette needs to see it
// on something, and a colour picker whose result only shows up on a different
// device is a guessing game. The admin's own identity stays distinct where it
// is supposed to — the app icon inverts the palette on purpose (see
// frontend/CLAUDE.md) and is not affected by this.
//
// This file is a near-copy of the player's. That is the package boundary
// working as intended, not duplication to factor out: the shared part is
// `paletteCssVars`, and what is left is the ~15 lines that touch `document`,
// which is exactly what each client is supposed to write for itself.
//
// Everything about WHICH colours apply is decided by `paletteCssVars` in
// @minigames/tokens — pure, tested, and shared with the native clients, which
// will consume the same resolution through `resolvePalette` and a StyleSheet
// instead of custom properties. What is left here is genuinely web-only: the
// fact that Tailwind v4 compiles `bg-brand` to `background-color:
// var(--color-brand)`, so redefining that variable on the root element
// re-colours every utility built on it without a rebuild.
//
// One caveat worth knowing before someone debugs it: opacity utilities
// (`text-ink/70`) compile to a `color-mix()` over the same variable behind an
// `@supports` guard, with a *baked* hex as the fallback. On a browser without
// color-mix those translucent shades keep the build-time colour while solid
// ones change. Every browser this runs on in-store has it; nothing here can fix
// the ones that do not.

import { useEffect, useRef } from "react";
import { paletteCssVars } from "@minigames/tokens";

/**
 * Applies the store's colour overrides for as long as the component is mounted.
 *
 * The cleanup REMOVES the properties rather than restoring previous values,
 * which is what makes clearing an override in the admin actually revert: with
 * the inline property gone, the cascade falls back to the `@theme` block in the
 * generated theme.css — the compiled-in token — with no need to know what it
 * was.
 */
export function useBrandPalette(settings: Record<string, string> | null): void {
  const vars = paletteCssVars(settings);

  // Key on the resolved pairs, not the settings object: the settings hook hands
  // back a fresh object on every kiosk refresh, and re-writing identical values
  // to the document each time would be churn for nothing. The ref carries the
  // pairs themselves past the dependency check — they are always in step with
  // the key that gates it.
  const key = vars.map(([prop, value]) => `${prop}=${value}`).join(",");
  const latest = useRef(vars);
  latest.current = vars;

  useEffect(() => {
    const applied = latest.current;
    if (applied.length === 0) return;

    const root = document.documentElement;
    for (const [prop, value] of applied) root.style.setProperty(prop, value);

    return () => {
      for (const [prop] of applied) root.style.removeProperty(prop);
    };
  }, [key]);
}
