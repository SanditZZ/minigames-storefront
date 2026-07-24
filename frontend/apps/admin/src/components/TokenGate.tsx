import { useState } from "react";
import { ApiError } from "@minigames/api-client";
import { makeApi, setToken } from "../api";
import { Button, Input } from "../ui";

/**
 * A minimal auth gate for the shared-secret admin API. It validates the entered
 * token with a real request (list settings) before storing it, so a wrong
 * secret fails here rather than on every later action.
 */
export function TokenGate({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [token, setTok] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await makeApi(token).listSettings(); // 401 throws if the secret is wrong
      setToken(token);
      onAuthenticated(token);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Invalid admin token." : "Could not reach the API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-brand-4 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg ring-1 ring-ink/5">
        <h1 className="text-xl font-bold text-ink">Admin sign in</h1>
        <p className="mt-1 text-sm text-ink/60">Enter the admin token to manage rewards and settings.</p>
        <Input
          type="password"
          value={token}
          onChange={(e) => setTok(e.target.value)}
          placeholder="Admin token"
          className="mt-4"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy || !token} className="mt-4 w-full">
          {busy ? "Checking…" : "Sign in"}
        </Button>
        <p className="mt-3 text-xs text-ink/40">
          Dev default: <code>dev-admin-token</code>
        </p>
      </form>
    </div>
  );
}
