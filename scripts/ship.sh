#!/usr/bin/env bash
#
# ship.sh — the build-gated "apply a change" flow for this repo.
#
# Runs, in order, and STOPS on the first failure so a broken change never
# reaches main:
#   1. backend unit tests        (go test ./...)
#   2. build + redeploy           (scripts/serve-prod.sh — builds API binary +
#                                  both frontend bundles incl. typecheck, then
#                                  restarts the local stack so it reflects the change)
#   3. commit + push to main      (only reached if 1 and 2 succeed)
#
# Usage:
#   ./scripts/ship.sh                       # auto commit message
#   ./scripts/ship.sh "feat: add reaction game"
#
# set -e ensures any failing step aborts before the commit/push — main stays green.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-chore: auto-ship $(date '+%Y-%m-%d %H:%M:%S')}"

echo "▸ [1/3] Backend tests…"
(cd "$ROOT/backend" && go test ./...)

echo "▸ [2/3] Build + redeploy…"
"$ROOT/scripts/serve-prod.sh"

echo "▸ [3/3] Commit + push to main…"
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
