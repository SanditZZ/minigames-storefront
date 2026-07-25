import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { HeaderRow } from "./Layout";

/** How long the "Sure?" state waits before giving up and reverting to "Quit". */
const CONFIRM_TIMEOUT_MS = 2500;

/**
 * The shared frame EVERY game renders inside. It supplies the consistent
 * chrome — title bar and quit control — so individual games only provide their
 * interaction as children and can never drift from the app's look and feel.
 */
export function GameStage({
  title,
  subtitle,
  onQuit,
  confirmQuit = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onQuit: () => void;
  /**
   * Require a second press to quit. Set while a round is actually running: the
   * quit control sits close to a rapid-tap target, and a stray thumb should not
   * be able to throw away a round mid-play. Off before the round starts, where
   * backing out is free and asking twice would just be friction.
   */
  confirmQuit?: boolean;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  // The confirmation disarms itself, so a player who tapped Quit by accident
  // and then ignored it is not left one stray press from losing the round.
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [armed]);

  // A round that ends while the confirmation is showing must not leave it armed
  // for whatever comes next.
  useEffect(() => {
    if (!confirmQuit) setArmed(false);
  }, [confirmQuit]);

  function handleQuit() {
    if (!confirmQuit || armed) {
      onQuit();
      return;
    }
    setArmed(true);
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <HeaderRow
        title={title}
        subtitle={subtitle}
        action={
          <Button
            variant={armed ? "primary" : "ghost"}
            size="sm"
            onClick={handleQuit}
            aria-label={armed ? "Confirm quitting this round" : "Quit"}
          >
            {armed ? "Sure?" : "Quit"}
          </Button>
        }
      />
      {children}
    </div>
  );
}
