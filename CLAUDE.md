# Repo rules — minigames-storefront

## Auto-ship after every change (build-gated) — REQUIRED

After making **any** change to this repo (code, config, or docs), always run the
ship flow before considering the change done — do not skip it:

```bash
./scripts/ship.sh ["commit message"]
```

It runs, in order, and **stops on the first failure**:

1. `go test ./...` (backend) — must pass.
2. Build + redeploy via `scripts/serve-prod.sh` — the backend binary and both
   frontend bundles must build (TypeScript typecheck included), then the local
   stack is redeployed so the running player/admin apps immediately reflect the
   change (on their Tailscale-reachable ports).
3. Only if 1–2 succeed: `git add -A`, commit, and `git push origin main`.

### Rules

- **Never commit or push if tests or the build fail.** Fix the failure (or report
  it and stop) instead — `main` must always stay green and deployable.
- **Always push to `main`.** Every applied change ends up on the remote.
- **No `Co-Authored-By`** lines in commit messages.
- Redeploy is part of shipping — the user expects the running apps to update after
  every change, not just the code.
- The deploy binds servers to `0.0.0.0` and bakes the auto-detected Tailscale IP
  into the frontend builds (see `scripts/serve-prod.sh` and the global "Local
  Deployment" rules), so the apps stay reachable across the tailnet.

## Related

- `frontend/CLAUDE.md` — mandatory color palette + reusable-UI-component rules.
- `docs/architecture.md`, `docs/potential-features.md` — design + roadmap.
