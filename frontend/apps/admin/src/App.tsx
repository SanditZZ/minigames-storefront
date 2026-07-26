import { useCallback, useEffect, useMemo, useState } from "react";
import type { Game, Setting } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { settingsToMap } from "@minigames/admin-core";
import { clearToken, getToken, makeApi } from "./api";
import { useBrandPalette } from "./theme/useBrandPalette";
import { TokenGate } from "./components/TokenGate";
import { AwardsPanel } from "./components/AwardsPanel";
import { ClaimsPanel } from "./components/ClaimsPanel";
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

  // Settings are owned here, not by the panel that edits them, because the
  // store's palette applies to the whole document — see useBrandPalette. The
  // one request doubles as the token check it always was: a stored secret can
  // stop being valid (rotated, or a stale default), and rendering panels where
  // every call 401s is worse than dropping back to the sign-in gate.
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [settingsToken, setSettingsToken] = useState(0);
  const reloadSettings = useCallback(() => setSettingsToken((n) => n + 1), []);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    api
      .listSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setSettingsError("");
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          clearToken();
          setTokenState("");
          return;
        }
        setSettingsError(e.message ?? "Failed to load settings");
      });

    return () => {
      alive = false;
    };
  }, [api, token, settingsToken]);

  // The admin wears the store's own colours, so choosing one is a preview
  // rather than a guess. Applying it at the shell means a saved colour lands on
  // every panel at once, which is also the honest test of a bad choice.
  useBrandPalette(useMemo(() => settingsToMap(settings), [settings]));

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
      {router.tab === "claims" && (
        <ClaimsPanel
          api={api}
          status={router.location.claimStatus}
          onStatusChange={(claimStatus) => router.setFilters({ claimStatus })}
        />
      )}
      {router.tab === "settings" && (
        <SettingsPanel
          api={api}
          games={games}
          settings={settings}
          error={settingsError}
          onChanged={reloadSettings}
        />
      )}
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
