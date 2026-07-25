import type { ReactNode } from "react";
import { Button } from "./Button";
import { HeaderRow } from "./Layout";

/**
 * The shared frame EVERY game renders inside. It supplies the consistent
 * chrome — title bar and quit control — so individual games only provide their
 * interaction as children and can never drift from the app's look and feel.
 */
export function GameStage({
  title,
  subtitle,
  onQuit,
  children,
}: {
  title: string;
  subtitle?: string;
  onQuit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <HeaderRow
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="ghost" size="sm" onClick={onQuit}>
            Quit
          </Button>
        }
      />
      {children}
    </div>
  );
}
