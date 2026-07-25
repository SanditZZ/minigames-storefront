#!/usr/bin/env bash
#
# ship.sh — the build-gated "apply a change" flow for this repo.
#
# Runs, in order, and STOPS on the first failure so a broken change never
# reaches main:
#   1. backend unit tests         (go test ./...)
#   2. frontend unit tests        (vitest — router + reveal calculations)
#   3. end-to-end browser tests   (Playwright, against an isolated throwaway
#                                  stack on its own ports and its own DB)
#   4. build + redeploy           (scripts/serve-prod.sh — builds API binary +
#                                  both frontend bundles incl. typecheck, then
#                                  restarts the local stack so it reflects the change)
#   5. commit + push to main      (only reached if 1–4 succeed)
#
# The full suite runs BEFORE every push, by design — see CLAUDE.md.
#
# Usage:
#   ./scripts/ship.sh                       # auto commit message
#   ./scripts/ship.sh "feat: add reaction game"
#   SKIP_E2E=1 ./scripts/ship.sh            # escape hatch, see below
#
# SKIP_E2E exists only for machines where browsers genuinely cannot run. It is
# NOT for stepping past a failing test — a red E2E means the player flow is
# broken, which is exactly what the gate is for.
#
# set -e ensures any failing step aborts before the commit/push — main stays green.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-chore: auto-ship $(date '+%Y-%m-%d %H:%M:%S')}"

echo "▸ [1/5] Backend tests…"
(cd "$ROOT/backend" && go test ./...)

echo "▸ [2/5] Frontend unit tests…"
(cd "$ROOT/frontend" && npm test --silent)

if [[ "${SKIP_E2E:-}" == "1" ]]; then
  echo "▸ [3/5] E2E browser tests… SKIPPED (SKIP_E2E=1)"
else
  echo "▸ [3/5] E2E browser tests…"
  if [[ ! -d "$ROOT/e2e/node_modules" ]]; then
    echo "  installing e2e dependencies…"
    (cd "$ROOT/e2e" && npm install --silent && npx playwright install chromium)
  fi
  (cd "$ROOT/e2e" && npx playwright test)
fi

echo "▸ [4/5] Build + redeploy…"
"$ROOT/scripts/serve-prod.sh"

echo "▸ [5/5] Commit + push to main…"
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  echo "  committed: $MSG"
else
  echo "  no file changes to commit."
fi
# Push whatever is ahead of origin/main (no-op if already up to date).
git push origin main

echo "✓ Shipped. main is green and pushed."
