#!/usr/bin/env bash
#
# serve-prod.sh — build production artifacts and serve the whole stack on
# automatically-chosen FREE ports: Go API + player + admin.
#
#   ./scripts/serve-prod.sh          build everything and start (default)
#   ./scripts/serve-prod.sh --stop   stop a previously started stack
#   ./scripts/serve-prod.sh --no-build   (re)start without rebuilding
#
# Tools used: `go build` (API binary), `vite build` (bundles), `vite preview`
# (static file server bundled with Vite). No Docker/nginx/Caddy required.
#
# Reversibility: PIDs are recorded under .prod/ and `--stop` kills exactly those
# processes. Starting first stops any prior stack, so re-running is safe.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT/.prod"
PID_FILE="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"
ADMIN_TOKEN="${APP_ADMIN_TOKEN:-dev-admin-token}"

mkdir -p "$STATE_DIR" "$LOG_DIR"

stop_stack() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done <"$PID_FILE"
    rm -f "$PID_FILE"
    echo "Stopped previously running stack."
  else
    echo "No running stack recorded."
  fi
}

# Prints the first free TCP port at/after $1 (checked with ss).
find_free_port() {
  local port="$1"
  while ss -ltn 2>/dev/null | grep -q ":${port} "; do
    port=$((port + 1))
  done
  echo "$port"
}

if [[ "${1:-}" == "--stop" ]]; then
  stop_stack
  exit 0
fi

DO_BUILD=1
[[ "${1:-}" == "--no-build" ]] && DO_BUILD=0

# Always start from a clean slate so ports/pids never leak across runs.
stop_stack

# Backend scans upward from 8080; frontends scan upward from 3000 (kept in
# separate ranges so the API and UI ports are easy to tell apart).
API_PORT="$(find_free_port 8080)"
PLAYER_PORT="$(find_free_port 3000)"
ADMIN_PORT="$(find_free_port $((PLAYER_PORT + 1)))"

API_URL="http://localhost:${API_PORT}"
PLAYER_URL="http://localhost:${PLAYER_PORT}"
ADMIN_URL="http://localhost:${ADMIN_PORT}"

echo "Chosen free ports → API:${API_PORT}  player:${PLAYER_PORT}  admin:${ADMIN_PORT}"

if [[ "$DO_BUILD" == "1" ]]; then
  echo "▸ Building API binary…"
  (cd "$ROOT/backend" && go build -o bin/server ./cmd/server)

  echo "▸ Building frontends (baking API URL ${API_URL})…"
  # Vite inlines VITE_* at build time, so the built bundles call the right API.
  export VITE_API_BASE_URL="$API_URL"
  (cd "$ROOT/frontend" && npm run build -w apps/player >/dev/null && npm run build -w apps/admin >/dev/null)
fi

echo "▸ Starting API…"
APP_ADDR=":${API_PORT}" \
APP_DB_PATH="$STATE_DIR/minigames.db" \
APP_CORS_ORIGINS="${PLAYER_URL},${ADMIN_URL}" \
APP_ADMIN_TOKEN="$ADMIN_TOKEN" \
  "$ROOT/backend/bin/server" >"$LOG_DIR/api.log" 2>&1 &
echo $! >>"$PID_FILE"

echo "▸ Serving player + admin (vite preview)…"
(cd "$ROOT/frontend/apps/player" && npx vite preview --port "$PLAYER_PORT" --strictPort >"$LOG_DIR/player.log" 2>&1) &
echo $! >>"$PID_FILE"
(cd "$ROOT/frontend/apps/admin" && npx vite preview --port "$ADMIN_PORT" --strictPort >"$LOG_DIR/admin.log" 2>&1) &
echo $! >>"$PID_FILE"

# Give the servers a moment, then verify they respond.
sleep 3
api_ok=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/healthz" || echo "000")
player_ok=$(curl -s -o /dev/null -w "%{http_code}" "$PLAYER_URL" || echo "000")
admin_ok=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL" || echo "000")

echo
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Minigames Storefront — production stack                    │"
echo "├────────────┬────────────────────────────────┬───────────────┤"
printf "│  %-9s │  %-30s │  HTTP %-6s │\n" "API"    "$API_URL"    "$api_ok"
printf "│  %-9s │  %-30s │  HTTP %-6s │\n" "Player" "$PLAYER_URL" "$player_ok"
printf "│  %-9s │  %-30s │  HTTP %-6s │\n" "Admin"  "$ADMIN_URL"  "$admin_ok"
echo "└────────────┴────────────────────────────────┴───────────────┘"
echo "Admin token: ${ADMIN_TOKEN}"
echo "Logs: $LOG_DIR   Stop: ./scripts/serve-prod.sh --stop"
