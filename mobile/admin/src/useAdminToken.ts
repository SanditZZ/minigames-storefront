// ACTIONS layer: the admin credential's lifecycle on a phone.
//
// Extracted when the second screen arrived. Before that it lived inline in the
// awards screen, which was fine for one screen and would have been two copies of
// the one flow with a failure mode nobody notices: a 401 handled on one screen
// and not the other leaves a rejected token in the keychain, and every later
// request on that screen fails as "signed out" for no visible reason.
//
// It is a hook rather than a context on purpose. The gate is per-screen — each
// screen renders the sign-in form itself, with the same testIDs — because
// `expo-router`'s Stack mounts screens independently and a context in the layout
// would have meant moving the gate out of the flow the Maestro suite drives.

import { useCallback, useEffect, useState } from "react";
import { clearToken, getToken, setToken } from "./api";

/** Loading is DISTINCT from signed-out: the keychain read is async. */
export type TokenState = { status: "loading" } | { status: "signedOut" } | { status: "ready"; token: string };

export interface AdminToken {
  state: TokenState;
  /** Store a token the user just typed and sign in with it. */
  signIn: (token: string) => Promise<void>;
  /**
   * Throw away the stored token after the server rejected it.
   *
   * The clearing is the point: a bad secret left in the keychain fails every
   * later request, and on a cold start it fails before anything is on screen —
   * which looks like the app being broken rather than like a wrong password.
   */
  reject: () => Promise<void>;
}

export function useAdminToken(): AdminToken {
  const [state, setState] = useState<TokenState>({ status: "loading" });

  useEffect(() => {
    void getToken().then((token) => setState(token === "" ? { status: "signedOut" } : { status: "ready", token }));
  }, []);

  const signIn = useCallback(async (token: string) => {
    await setToken(token);
    setState({ status: "ready", token });
  }, []);

  const reject = useCallback(async () => {
    await clearToken();
    setState({ status: "signedOut" });
  }, []);

  return { state, signIn, reject };
}
