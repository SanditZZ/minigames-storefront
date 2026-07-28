import type { IconName } from "@minigames/icons";
import { useEffect, useState } from "react";
import { copyText } from "../clipboard/copy";
import { useT, type MessageKey } from "../i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** How long the button admits to having copied before reverting. */
const CONFIRM_MS = 1800;

type State = "idle" | "copied" | "failed";

const labels: Record<State, { icon: IconName; textKey: MessageKey }> = {
  idle: { icon: "clipboard", textKey: "copy.idle" },
  copied: { icon: "check", textKey: "copy.copied" },
  failed: { icon: "triangle-alert", textKey: "copy.failed" },
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
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [state, setState] = useState<State>("idle");
  // The default names the thing generically ("code"); callers that know better
  // pass their own already-translated noun.
  const noun = label ?? t("copy.label");

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

  const { icon, textKey } = labels[state];

  return (
    <Button variant="quiet" size="sm" onClick={handleCopy} aria-label={t("copy.aria", { label: noun })}>
      <Icon name={icon} />
      <span className="ml-1.5">{t(textKey)}</span>
      {/* The visual label changes under the pointer; a screen reader gets the
          outcome announced instead of silently re-reading the button. */}
      <span className="sr-only" role="status">
        {state === "copied"
          ? t("copy.announceCopied", { label: noun })
          : state === "failed"
            ? t("copy.announceFailed", { label: noun })
            : ""}
      </span>
    </Button>
  );
}
