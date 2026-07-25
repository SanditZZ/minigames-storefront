import type { ReactNode } from "react";
import { Button } from "./Button";
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
 * The one full-screen message state: an emoji, a line of copy, and an optional
 * action. Errors, empty states, and "not found" all render through this so a
 * dead end never looks unstyled.
 */
export function StatusMessage({
  icon,
  title,
  detail,
  action,
}: {
  icon?: string;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <CenterStack>
      {icon && (
        <div className="text-5xl" aria-hidden>
          {icon}
        </div>
      )}
      <div className="max-w-sm text-center">
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
