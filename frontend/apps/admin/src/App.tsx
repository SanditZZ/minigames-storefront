import { useEffect, useMemo, useState } from "react";
import type { Game } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { clearToken, getToken, makeApi } from "./api";
import { TokenGate } from "./components/TokenGate";
import { AwardsPanel } from "./components/AwardsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ScoresPanel } from "./components/ScoresPanel";
import { TABS, useRouter } from "./router";
import { AppShell, Button, Tabs, TopBar } from "./ui";

/**
 * Admin shell: gates on the shared secret, then presents the CRUD panels. It
 * owns only navigation + session; all data work lives in the panels, which talk
 * to the backend through the typed client.
 *
 * Which panel is showing comes from the URL rather than component state, so an
 * admin can bookmark a panel, deep-link a colleague to one, and use Back and
 * Forward instead of re-clicking tabs after every reload.
 */
export function App() {
  const [token, setTokenState] = useState(getToken());
  const api = useMemo(() => makeApi(token), [token]);
  const router = useRouter();
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
          <Tabs tabs={TABS} active={router.tab} onSelect={router.setTab} />
        </>
      }
    >
      {router.tab === "awards" && <AwardsPanel api={api} games={games} router={router} />}
      {router.tab === "settings" && <SettingsPanel api={api} />}
      {router.tab === "scores" && (
        <ScoresPanel
          api={api}
          games={games}
          slug={router.location.gameSlug}
          onSlugChange={(gameSlug) => router.setFilters({ gameSlug })}
        />
      )}
    </AppShell>
  );
}
