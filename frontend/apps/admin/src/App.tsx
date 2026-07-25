import { useEffect, useMemo, useState } from "react";
import type { Game } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { clearToken, getToken, makeApi } from "./api";
import { TokenGate } from "./components/TokenGate";
import { AwardsPanel } from "./components/AwardsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ScoresPanel } from "./components/ScoresPanel";
import { AppShell, Button, Tabs, TopBar } from "./ui";

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

  // A stored token can stop being valid — the secret gets rotated, or a stale
  // one is left over from an earlier default. Revalidate on mount and drop back
  // to the sign-in gate, rather than rendering panels where every call 401s.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.listSettings().catch((e) => {
      if (alive && e instanceof ApiError && e.status === 401) {
        clearToken();
        setTokenState("");
      }
    });
    return () => {
      alive = false;
    };
  }, [api, token]);

  if (!token) {
    return <TokenGate onAuthenticated={setTokenState} />;
  }

  function logout() {
    clearToken();
    setTokenState("");
  }

  return (
    <AppShell
      header={
        <>
          <TopBar
            title="Minigames Admin"
            action={
              <Button variant="ghost" onClick={logout}>
                Sign out
              </Button>
            }
          />
          <Tabs tabs={TABS} active={tab} onSelect={setTab} />
        </>
      }
    >
      {tab === "awards" && <AwardsPanel api={api} games={games} />}
      {tab === "settings" && <SettingsPanel api={api} />}
      {tab === "scores" && <ScoresPanel api={api} games={games} />}
    </AppShell>
  );
}
