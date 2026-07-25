// ACTIONS layer: putting text on the system clipboard. Touches `navigator`,
// `document`, and the clipboard itself, so it lives in the app rather than in a
// package (see frontend/CLAUDE.md).

/**
 * Copies `text`, returning whether it worked.
 *
 * The two-path implementation is not defensive padding — the fallback is the
 * path this app actually takes in normal use. `navigator.clipboard` is gated on
 * a SECURE CONTEXT: HTTPS, or `localhost`. This stack is served over plain HTTP
 * on a Tailscale address (`http://100.64.x.x:3000` — see scripts/serve-prod.sh
 * and the repo's local-deployment rules), which is neither. On a phone across
 * the tailnet, `navigator.clipboard` is simply `undefined`, and a copy button
 * written the modern way would fail every time on the only device anyone
 * actually reads a claim code on.
 *
 * So: try the real API when it exists, and fall back to the deprecated
 * `execCommand("copy")`, which has no secure-context requirement and is still
 * implemented everywhere. If HTTPS ever arrives, the first path starts winning
 * on its own and nothing here needs revisiting.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refused, or a browser that exposes the API and then denies
      // it. Fall through rather than reporting a failure we can still avoid.
    }
  }

  return copyViaSelection(text);
}

/**
 * The pre-Clipboard-API technique: put the text in an off-screen field, select
 * it, and ask the document to copy the selection.
 *
 * `execCommand` is deprecated and works anyway. The details that matter:
 * the field must be IN the document and focusable (a `display: none` element
 * cannot be selected), it must not scroll the page while doing so, and it needs
 * its own `user-select: text` — this app disables selection on its game
 * surfaces, and an unselectable textarea copies nothing.
 */
function copyViaSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.width = "1px";
  field.style.height = "1px";
  field.style.padding = "0";
  field.style.border = "none";
  field.style.opacity = "0";
  field.style.userSelect = "text";
  field.style.webkitUserSelect = "text";

  document.body.appendChild(field);

  // Preserve whatever the player had selected; silently clearing it would be a
  // second, unrequested change.
  const previous = document.activeElement as HTMLElement | null;

  let ok = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    // iOS ignores select() on a readonly field and needs an explicit range.
    field.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(field);
    previous?.focus?.();
  }
  return ok;
}
