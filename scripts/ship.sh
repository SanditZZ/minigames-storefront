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
#   4. mobile typecheck           (tsc over the Expo client, only when its deps
#                                  are already installed — see below)
#   5. build + redeploy           (scripts/serve-prod.sh — builds API binary +
#                                  both frontend bundles incl. typecheck, then
#                                  restarts the local stack so it reflects the change)
#   6. commit + push to main      (only reached if 1–5 succeed)
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
# KNOWN GAP: step 4 typechecks the native client but does not RUN it. There is
# no Maestro/Detox suite yet, so nothing here catches a mobile screen that
# compiles and then crashes on a device — unlike the web player, which step 3
# actually drives in a browser. Until that suite exists, a green ship.sh says
# nothing about whether the Expo app works. See mobile/CLAUDE.md.
#
# set -e ensures any failing step aborts before the commit/push — main stays green.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-chore: auto-ship $(date '+%Y-%m-%d %H:%M:%S')}"

echo "▸ [1/6] Backend tests…"
(cd "$ROOT/backend" && go test ./...)

echo "▸ [2/6] Frontend typecheck + unit tests…"
# Runs the SAME npm scripts CI runs, not equivalent-looking ad-hoc commands.
# A broken `typecheck` script once sat unnoticed precisely because the gate and
# CI invoked different things.
(cd "$ROOT/frontend" && npm run typecheck --silent && npm test --silent)

if [[ "${SKIP_E2E:-}" == "1" ]]; then
  echo "▸ [3/6] E2E browser tests… SKIPPED (SKIP_E2E=1)"
else
  echo "▸ [3/6] E2E browser tests…"
  if [[ ! -d "$ROOT/e2e/node_modules" ]]; then
    echo "  installing e2e dependencies…"
    (cd "$ROOT/e2e" && npm install --silent && npx playwright install chromium)
  fi
  # Playwright transpiles specs without typechecking them; do it explicitly.
  (cd "$ROOT/e2e" && npx tsc --noEmit && npx playwright test)
fi

# Deliberately NOT auto-installing: the Expo tree is ~600 packages, and a
# contributor who has never touched the native client should not pay for it on
# an unrelated docs push. Once mobile/admin/node_modules exists, this becomes a
# hard gate — the shared packages it consumes change often, and a rename in
# admin-core must not be discovered by a phone.
echo "▸ [4/6] Mobile typecheck + E2E…"
if [[ ! -d "$ROOT/mobile/admin/node_modules" ]]; then
  echo "  SKIPPED — run 'npm install' in mobile/admin to enable."
else
  (cd "$ROOT/mobile/admin" && npx tsc --noEmit)

  # Find the tools where their installers actually put them. Neither ends up on
  # PATH by default, and a gate that skips because of PATH rather than because
  # of a missing device is the worst of both worlds: it looks like it ran.
  export PATH="$HOME/.maestro/bin:${ANDROID_HOME:-$HOME/android-sdk}/platform-tools:$PATH"

  # The Maestro suite needs a booted emulator or an attached phone, which is not
  # something every machine has — the same shape of constraint as SKIP_E2E for
  # the browser suite, and handled the same way: skip loudly, never silently.
  #
  # A skip here means the native client was COMPILED and not RUN. If the change
  # touched mobile/ or a package it consumes, boot an emulator and re-run before
  # pushing; a green ship.sh alone does not cover it.
  if ! command -v maestro >/dev/null; then
    echo "  ⚠ E2E SKIPPED — maestro not installed (https://maestro.mobile.dev)."
  elif [[ -z "$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"')" ]]; then
    echo "  ⚠ E2E SKIPPED — no emulator or device attached."
  else
    "$ROOT/mobile/admin/scripts/run-e2e.sh"
  fi
fi

echo "▸ [5/6] Build + redeploy…"
"$ROOT/scripts/serve-prod.sh"

echo "▸ [6/6] Commit + push to main…"
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
