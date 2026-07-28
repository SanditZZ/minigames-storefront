import type { IconName } from "@minigames/icons";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { CenterStack } from "./Layout";

/** Centred spinner + optional label, for loading/transitional states. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink/20 border-t-brand" />
      {label && <p className="text-ink/70">{label}</p>}
    </div>
  );
}

/**
 * The one full-screen message state: an icon, a line of copy, and an optional
 * action. Errors, empty states, and "not found" all render through this so a
 * dead end never looks unstyled.
 *
 * It is always a live region, because every one of these replaces something the
 * player was waiting on — usually a `Spinner`, whose own region disappears with
 * it. Without one, a failed submit was announced as nothing at all: the icon is
 * `aria-hidden` and the copy is ordinary text, so a screen reader user sat on a
 * silent screen.
 *
 * `tone` picks how loudly. A failure interrupts (`role="alert"`); a dead end the
 * player navigated to themselves does not (`role="status"`, polite), since they
 * already know they arrived and an assertive region would cut off whatever else
 * was speaking.
 */
export function StatusMessage({
  icon,
  title,
  detail,
  action,
  tone = "info",
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
  tone?: "info" | "error";
}) {
  const live =
    tone === "error"
      ? ({ role: "alert" } as const)
      : ({ role: "status", "aria-live": "polite" } as const);

  return (
    <CenterStack>
      {icon && (
        <div className="text-5xl text-ink/30">
          <Icon name={icon} />
        </div>
      )}
      {/* The region wraps the copy only — not the icon (hidden anyway) and not
          the action, whose label is read as a button when focus reaches it. */}
      <div className="max-w-sm text-center" {...live}>
        <p className="text-lg font-bold text-ink">{title}</p>
        {detail && <p className="mt-1 text-ink/70">{detail}</p>}
      </div>
      {action && (
        <Button size="lg" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </CenterStack>
  );
}

/** Inline placeholder used inside a card when a list has nothing to show. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-ink/50">{children}</p>;
}
