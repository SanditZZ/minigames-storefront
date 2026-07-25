import { useEffect, useState } from "react";
import { copyText } from "../clipboard/copy";
import { Button } from "./Button";

/** How long the button admits to having copied before reverting. */
const CONFIRM_MS = 1800;

type State = "idle" | "copied" | "failed";

const labels: Record<State, { icon: string; text: string }> = {
  idle: { icon: "📋", text: "Copy" },
  copied: { icon: "✅", text: "Copied" },
  failed: { icon: "⚠️", text: "Select it instead" },
};

/**
 * Copies a value, and says whether it worked.
 *
 * The failure state is not decoration. Copying can genuinely fail — a browser
 * that denies clipboard permission, or one where the fallback is blocked — and
 * a button that silently does nothing is worse than no button at all, because
 * the player walks to the counter believing they have the code. When it fails
 * it points at the thing that always works: selecting the text, which is why
 * `user-select` is scoped to the game surfaces rather than set on `body`.
 */
export function CopyButton({ value, label = "code" }: { value: string; label?: string }) {
  const [state, setState] = useState<State>("idle");

  // Revert to idle so the button is honest about a SECOND copy: leaving
  // "Copied" on screen would make the next press look like it did nothing.
  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function handleCopy() {
    setState((await copyText(value)) ? "copied" : "failed");
  }

  const { icon, text } = labels[state];

  return (
    <Button variant="quiet" size="sm" onClick={handleCopy} aria-label={`Copy the ${label}`}>
      <span aria-hidden>{icon}</span>
      <span className="ml-1.5">{text}</span>
      {/* The visual label changes under the pointer; a screen reader gets the
          outcome announced instead of silently re-reading the button. */}
      <span className="sr-only" role="status">
        {state === "copied" ? `${label} copied` : state === "failed" ? `could not copy the ${label}` : ""}
      </span>
    </Button>
  );
}
