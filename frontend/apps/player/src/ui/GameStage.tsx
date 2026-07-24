import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * The shared frame EVERY game renders inside. It supplies the consistent
 * chrome — title bar and quit control — so individual games only provide their
 * interaction as children and can never drift from the app's look and feel.
 */
export function GameStage({ title, onQuit, children }: { title: string; onQuit: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-1 pb-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">{title}</h2>
        <Button variant="ghost" size="md" onClick={onQuit} className="shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-sm">
          Quit
        </Button>
      </header>
      {children}
    </div>
  );
}
