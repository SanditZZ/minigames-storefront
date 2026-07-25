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
ADMIN_TOKEN="${APP_ADMIN_TOKEN:-admin}"

mkdir -p "$STATE_DIR" "$LOG_DIR"

# Recursively kill a process and all its descendants. `npx vite preview` spawns
# a node child; killing only the npx parent orphans the child (which keeps
# holding its port), so we must walk the whole tree.
kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

stop_stack() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      [[ -n "$pid" ]] && kill_tree "$pid"
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

DO_BUILD=1
PUBLIC_HOST="${APP_PUBLIC_HOST:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stop) stop_stack; exit 0 ;;
    --no-build) DO_BUILD=0 ;;
    --host) PUBLIC_HOST="${2:-}"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# Host the BROWSER uses to reach the stack. This is baked into the frontend
# builds (as the API URL) and allowed by CORS, so it must be an address the
# client can reach — not "localhost", which on a remote device points at itself.
# Default: the Tailscale IP if present (reachable across the tailnet), else
# localhost. Override with `--host <addr>` or APP_PUBLIC_HOST=<addr>.
if [[ -z "$PUBLIC_HOST" ]]; then
  PUBLIC_HOST="$(tailscale ip -4 2>/dev/null | head -1 || true)"
fi
[[ -z "$PUBLIC_HOST" ]] && PUBLIC_HOST="localhost"

# Always start from a clean slate so ports/pids never leak across runs.
stop_stack

# Backend scans upward from 8080; frontends scan upward from 3000 (kept in
# separate ranges so the API and UI ports are easy to tell apart).
API_PORT="$(find_free_port 8080)"
PLAYER_PORT="$(find_free_port 3000)"
ADMIN_PORT="$(find_free_port $((PLAYER_PORT + 1)))"

# Public URLs (what the browser hits). Baked into the builds + allowed by CORS.
API_URL="http://${PUBLIC_HOST}:${API_PORT}"
PLAYER_URL="http://${PUBLIC_HOST}:${PLAYER_PORT}"
ADMIN_URL="http://${PUBLIC_HOST}:${ADMIN_PORT}"

# Loopback URLs used only for the local health checks below (always reachable
# from this host regardless of how the public host routes).
API_LOCAL="http://localhost:${API_PORT}"
PLAYER_LOCAL="http://localhost:${PLAYER_PORT}"
ADMIN_LOCAL="http://localhost:${ADMIN_PORT}"

echo "Public host: ${PUBLIC_HOST}"
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
# The API already binds all interfaces (APP_ADDR=":port"). Allow both the public
# host origins and localhost so the apps work whether reached via the Tailscale
# IP or locally.
APP_ADDR=":${API_PORT}" \
APP_DB_PATH="$STATE_DIR/minigames.db" \
APP_CORS_ORIGINS="${PLAYER_URL},${ADMIN_URL},${PLAYER_LOCAL},${ADMIN_LOCAL}" \
APP_ADMIN_TOKEN="$ADMIN_TOKEN" \
  "$ROOT/backend/bin/server" >"$LOG_DIR/api.log" 2>&1 &
echo $! >>"$PID_FILE"

echo "▸ Serving player + admin (vite preview on 0.0.0.0)…"
# --host 0.0.0.0 makes preview listen on ALL interfaces so it's reachable via
# the Tailscale IP (default preview binds loopback only).
# The redirect must sit OUTSIDE the subshell, not just on the vite command. A
# backgrounded subshell inherits this script's stdout/stderr, so if it keeps them
# open the whole stack holds the write end of any pipe ship.sh is feeding — and
# `./scripts/ship.sh | tee log` then hangs forever waiting for EOF, long after
# the script itself has finished.
(cd "$ROOT/frontend/apps/player" && npx vite preview --host 0.0.0.0 --port "$PLAYER_PORT" --strictPort) >"$LOG_DIR/player.log" 2>&1 &
echo $! >>"$PID_FILE"
(cd "$ROOT/frontend/apps/admin" && npx vite preview --host 0.0.0.0 --port "$ADMIN_PORT" --strictPort) >"$LOG_DIR/admin.log" 2>&1 &
echo $! >>"$PID_FILE"

# Give the servers a moment, then verify they respond (over loopback).
sleep 3
api_ok=$(curl -s -o /dev/null -w "%{http_code}" "${API_LOCAL}/healthz" || echo "000")
player_ok=$(curl -s -o /dev/null -w "%{http_code}" "$PLAYER_LOCAL" || echo "000")
admin_ok=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_LOCAL" || echo "000")

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
