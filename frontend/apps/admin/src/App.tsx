import { useEffect, useMemo, useState } from "react";
import type { Game } from "@minigames/api-client";
import { clearToken, getToken, makeApi } from "./api";
import { TokenGate } from "./components/TokenGate";
import { AwardsPanel } from "./components/AwardsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ScoresPanel } from "./components/ScoresPanel";
import { Button } from "./ui";

type Tab = "awards" | "settings" | "scores";
const TABS: { id: Tab; label: string }[] = [
  { id: "awards", label: "Awards" },
  { id: "settings", label: "Settings" },
  { id: "scores", label: "Scores" },
];

/**
 * Admin shell: gates on the shared secret, then presents the CRUD panels. It
 * owns only navigation + session; all data work lives in the panels, which talk
 * to the backend through the typed client.
 */
export function App() {
  const [token, setTokenState] = useState(getToken());
  const api = useMemo(() => makeApi(token), [token]);
  const [tab, setTab] = useState<Tab>("awards");
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!token) return;
    api.listGames().then(setGames).catch(() => setGames([]));
  }, [api, token]);

  if (!token) {
    return <TokenGate onAuthenticated={setTokenState} />;
  }

  function logout() {
    clearToken();
    setTokenState("");
  }

  return (
    <div className="min-h-full bg-brand-4">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-ink">Minigames Admin</h1>
          </div>
          <Button variant="ghost" className="shrink-0" onClick={logout}>
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? "border-brand text-ink" : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "awards" && <AwardsPanel api={api} games={games} />}
        {tab === "settings" && <SettingsPanel api={api} />}
        {tab === "scores" && <ScoresPanel api={api} games={games} />}
      </main>
    </div>
  );
}
