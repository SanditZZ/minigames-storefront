#!/usr/bin/env bash
#
# ship.sh — the build-gated "apply a change" flow for this repo.
#
# Runs, in order, and STOPS on the first failure so a broken change never
# reaches a PR:
#   1. backend unit tests         (go test ./...)
#   2. frontend unit tests        (vitest — router + reveal calculations)
#   3. end-to-end browser tests   (Playwright, against an isolated throwaway
#                                  stack on its own ports and its own DB)
#   4. mobile typecheck           (tsc over the Expo client, only when its deps
#                                  are already installed — see below)
#   5. build + redeploy           (scripts/serve-prod.sh — builds API binary +
#                                  both frontend bundles incl. typecheck, then
#                                  restarts the local stack so it reflects the change)
#   6. claims integrity check     (backfill-claims -check against the deployed
#                                  database — WARNS, never blocks; see below)
#   7. commit + push branch + open/update a PR
#                                  (only reached if 1–5 succeed; 6 never blocks)
#
# The full suite runs BEFORE every push, by design — see CLAUDE.md.
#
# This repo ships via branch + PR, not a direct push to main — `main` is
# protected and every change merges through review + CI, including the
# owner's own. Run this FROM a feature branch:
#   git checkout -b <branch-name>
#   ./scripts/ship.sh "feat: add reaction game"
# Running it while still on `main` refuses before any step runs (see the
# guard right below this header) rather than after 5+ minutes of tests.
#
# Usage:
#   ./scripts/ship.sh                       # auto commit message
#   ./scripts/ship.sh "feat: add reaction game"
#   SKIP_E2E=1 ./scripts/ship.sh            # escape hatch, see below
#   ALLOW_MAIN_PUSH=1 ./scripts/ship.sh     # deliberate exception, see below
#
# SKIP_E2E exists only for machines where browsers genuinely cannot run. It is
# NOT for stepping past a failing test — a red E2E means the player flow is
# broken, which is exactly what the gate is for.
#
# ALLOW_MAIN_PUSH exists for the rare deliberate direct-to-main change (a
# hotfix, a docs typo) — it is not a way to routinely skip the branch/PR flow.
#
# Step 6 is the ONE step here that does not gate. Every other step judges the
# change being shipped; that one judges the DATA the running stack holds, and a
# win missing its claim is not caused by, or fixed by, the commit in hand.
# Blocking a docs push on it would get the check deleted within a week — the
# same reason -check itself does not fail on unrepairable wins. It shouts and
# lets the push through.
#
# KNOWN GAP: step 4 typechecks the native client always, and runs its Maestro
# flows only when an emulator or phone is attached (see the checks below). On a
# machine with no device the skip is announced, but a green ship.sh still means
# the Expo app was COMPILED and not RUN — unlike the web player, which step 3
# always drives in a browser. See mobile/CLAUDE.md.
#
# set -e ensures any failing step aborts before the commit/push — the branch
# (and therefore the PR) only ever gets a green state.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-chore: auto-ship $(date '+%Y-%m-%d %H:%M:%S')}"

# Fail fast, before any test runs, rather than after 5+ minutes at the old
# push step. `main` is protected (PR + review + CI required) — this refusal
# is what keeps the owner's own exemption from becoming the one path nobody
# reviews.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "main" && "${ALLOW_MAIN_PUSH:-}" != "1" ]]; then
  echo "✗ Refusing to run on main — this repo ships via branch + PR now, not a" >&2
  echo "  direct push. Create a branch first:" >&2
  echo "    git checkout -b <branch-name>" >&2
  echo "  then re-run ./scripts/ship.sh. For a deliberate exception (a hotfix," >&2
  echo "  a docs typo), set ALLOW_MAIN_PUSH=1." >&2
  exit 1
fi

echo "▸ [1/7] Backend tests…"
(cd "$ROOT/backend" && go test ./...)

echo "▸ [2/7] Frontend theme check + typecheck + unit tests…"
# Runs the SAME npm scripts CI runs, not equivalent-looking ad-hoc commands.
# A broken `typecheck` script once sat unnoticed precisely because the gate and
# CI invoked different things.
#
# theme:check fails when a committed apps/*/src/theme.css no longer matches
# packages/tokens. It existed for a long time without either the gate or CI
# calling it — the same "check nobody runs" failure as that typecheck script.
# It runs FIRST because it is the cheapest step here and because a drifted
# palette makes everything downstream build a store in the wrong colours.
(cd "$ROOT/frontend" && npm run theme:check --silent && npm run typecheck --silent && npm test --silent)

if [[ "${SKIP_E2E:-}" == "1" ]]; then
  echo "▸ [3/7] E2E browser tests… SKIPPED (SKIP_E2E=1)"
else
  echo "▸ [3/7] E2E browser tests…"
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
echo "▸ [4/7] Mobile typecheck + E2E…"
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

echo "▸ [5/7] Build + redeploy…"
"$ROOT/scripts/serve-prod.sh"

# Nothing else ever notices a winning round that got no claim: issueClaim logs
# and returns nil, and a line in .prod/logs/api.log is not a signal anybody
# watches. This is the signal. It is read-only, takes no write lock, and is safe
# against the stack that step 5 just restarted.
#
# `set +e` around it deliberately: this step reports, it does not gate (see the
# header). Exit 2 means it looked and found something; exit 1 means it could not
# look, which is a different problem and must not be mistaken for a clean run.
echo "▸ [6/7] Claims integrity check…"
CLAIMS_DB="$ROOT/.prod/minigames.db"
if [[ ! -f "$CLAIMS_DB" ]]; then
  echo "  ⚠ SKIPPED — no database at $CLAIMS_DB (nothing has been played here yet)."
else
  set +e
  (cd "$ROOT/backend" && go run ./cmd/backfill-claims -db "$CLAIMS_DB" -check)
  CLAIMS_STATUS=$?
  set -e
  case "$CLAIMS_STATUS" in
    0) ;;
    2)
      echo "  ⚠ ACTION NEEDED — winning rounds are missing their claims."
      echo "    Stop the stack, then: cd backend && go run ./cmd/backfill-claims -db ../.prod/minigames.db -apply"
      echo "    Not blocking the push: this is a data hole, not a defect in this change."
      ;;
    *)
      echo "  ⚠ CHECK FAILED TO RUN (exit $CLAIMS_STATUS) — the claims table was not inspected."
      ;;
  esac
fi

echo "▸ [7/7] Commit + push branch + open/update PR…"
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  echo "  committed: $MSG"
else
  echo "  no file changes to commit."
fi

# -u so a brand-new branch gets its upstream set on the first push; a no-op
# flag on every push after that.
git push -u origin "$BRANCH"

# `gh pr view` fails (non-zero) when no PR exists yet for this branch — that
# failure is the branch of the `if`, not a script-aborting error under `set
# -e`, so this is the normal "first push on this branch" path, not a bug.
if gh pr view "$BRANCH" >/dev/null 2>&1; then
  echo "  PR already open for $BRANCH — pushed the update."
  gh pr view "$BRANCH" --json url -q .url
else
  gh pr create --fill --head "$BRANCH"
fi

echo "✓ Shipped $BRANCH. CI re-runs the same checks on the pushed commit; the PR is not merged automatically."
