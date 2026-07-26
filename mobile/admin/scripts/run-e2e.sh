#!/usr/bin/env bash
#
# run-e2e.sh — the native client's browser-suite equivalent.
#
# Mirrors what e2e/playwright.config.ts does for the web player: bring up an
# ISOLATED backend on its own port with its own throwaway SQLite file, run the
# flows against it, tear it down. It never touches .prod/ — a test run must not
# land on a real leaderboard or burn real prize stock.
#
# The one structural difference from the web suite is the API address. A web
# test hits 127.0.0.1 because the browser runs on this machine; the app under
# test here runs inside an emulator, which has its own loopback. 10.0.2.2 is the
# emulator's alias for the HOST's 127.0.0.1 — it is not a placeholder, and
# substituting localhost points the app at the emulator itself.
#
# Usage:
#   ./scripts/run-e2e.sh              # build the APK if missing, then test
#   ./scripts/run-e2e.sh --rebuild    # force a fresh APK first
#
# Requires: a running emulator or attached device (adb), maestro, Android SDK.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$APP_DIR/../.." && pwd)"

API_PORT=8399
DB_PATH="$(mktemp -u /tmp/minigames-mobile-e2e-XXXXXX.db)"
ADMIN_TOKEN="admin"
APP_ID="com.funstore.minigames.admin"

# RELEASE, not debug, and this is not a preference.
#
# A debug APK ships no JavaScript: it loads the bundle from a running Metro dev
# server at launch. Under Maestro that means the suite would silently depend on
# a second process being up, and would show a red "unable to load script" screen
# instead of the app if it were not. A release build embeds the bundle, so the
# APK under test is self-contained and is also the thing a staff phone would
# actually install. The android/ template already signs release with the
# checked-in debug keystore, so this needs no signing setup.
APK="$APP_DIR/android/app/build/outputs/apk/release/app-release.apk"

# The address the APP uses (inside the emulator) and the one THIS script uses.
DEVICE_API_URL="http://10.0.2.2:${API_PORT}"
HOST_API_URL="http://127.0.0.1:${API_PORT}"

api_pid=""
cleanup() {
  [[ -n "$api_pid" ]] && kill "$api_pid" 2>/dev/null || true
  rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
}
trap cleanup EXIT

command -v adb >/dev/null || { echo "✗ adb not found — add \$ANDROID_HOME/platform-tools to PATH"; exit 1; }
command -v maestro >/dev/null || { echo "✗ maestro not found — https://maestro.mobile.dev"; exit 1; }

if [[ -z "$(adb devices | awk 'NR>1 && $2=="device"')" ]]; then
  echo "✗ no emulator or device attached (adb devices is empty)."
  exit 1
fi

echo "▸ Starting throwaway API on :${API_PORT} (db: $DB_PATH)…"
(
  cd "$REPO/backend"
  APP_ADDR=":${API_PORT}" APP_DB_PATH="$DB_PATH" APP_ADMIN_TOKEN="$ADMIN_TOKEN" \
    go run ./cmd/server >/dev/null 2>&1
) &
api_pid=$!

# Wait for the seed to finish, not just the port to open: the flows assert on
# the starter awards, which are written during startup.
for _ in $(seq 1 60); do
  if curl -fsS "${HOST_API_URL}/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "${HOST_API_URL}/healthz" >/dev/null || { echo "✗ API never became healthy"; exit 1; }

seeded=$(curl -fsS -H "X-Admin-Token: ${ADMIN_TOKEN}" "${HOST_API_URL}/api/v1/admin/awards" | grep -o '"id"' | wc -l)
echo "  API healthy, ${seeded} awards seeded."
[[ "$seeded" -eq 6 ]] || { echo "✗ expected the 6 starter awards, got ${seeded} — flows assert on them"; exit 1; }

if [[ "${1:-}" == "--rebuild" || ! -f "$APK" ]]; then
  # Build native code for the ATTACHED device's ABI only. React Native compiles
  # C++ per architecture, and the default four (armeabi-v7a, arm64-v8a, x86,
  # x86_64) is most of the build time — three of which can never run on the
  # device in front of us. Gradle caches per ABI, so switching between an
  # emulator and a phone later just adds that one.
  abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
  echo "▸ Building release APK for ${abi} (pointed at ${DEVICE_API_URL})…"

  # The API address is baked into app.config's `extra` at BUILD time, so this
  # env var must be set for both commands — prebuild writes the native project,
  # gradle embeds the evaluated config.
  (cd "$APP_DIR" && EXPO_PUBLIC_API_URL="$DEVICE_API_URL" npx expo prebuild --platform android --no-install)
  (cd "$APP_DIR/android" && EXPO_PUBLIC_API_URL="$DEVICE_API_URL" \
    ./gradlew assembleRelease -PreactNativeArchitectures="$abi")
fi

echo "▸ Installing APK…"
adb install -r -d "$APK" >/dev/null

# A claim to redeem, WON rather than fabricated.
#
# The claims flow needs a real code, and the only honest way to get one is the way
# a customer does: start a session, submit a winning score, read the claim off the
# result. Inserting a row into SQLite would test the panel against a credential no
# player was ever issued — which is the exact seam these suites exist to cover
# (see e2e/tests/admin-claims.spec.ts, which plays a round for the same reason).
#
# 60 taps clears tap-fast's hardest starter award (backend/internal/app/seed.go),
# so the win is deterministic on a fresh database. The value is also inside the
# validator's plausible ceiling; a bigger number would be REJECTED as fabricated,
# which is the anti-cheat working and would look like a broken fixture.
echo "▸ Winning a claim to redeem…"
session_token=$(curl -fsS -X POST "${HOST_API_URL}/api/v1/games/tap-fast/sessions" |
  sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[[ -n "$session_token" ]] || { echo "✗ could not start a session"; exit 1; }

CLAIM_CODE=$(curl -fsS -X POST "${HOST_API_URL}/api/v1/games/tap-fast/scores" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${session_token}\",\"playerName\":\"Maestro\",\"value\":60}" |
  sed -n 's/.*"code":"\([^"]*\)".*/\1/p')
[[ -n "$CLAIM_CODE" ]] || { echo "✗ the winning round issued no claim — did the starter awards change?"; exit 1; }
echo "  won ${CLAIM_CODE}."

echo "▸ Running Maestro flows…"
maestro test -e ADMIN_TOKEN="$ADMIN_TOKEN" -e CLAIM_CODE="$CLAIM_CODE" "$APP_DIR/.maestro"

echo "✓ Mobile E2E passed."
