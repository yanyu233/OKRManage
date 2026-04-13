#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
SERVER_WORKDIR="$ROOT_DIR/apps/server"
SERVER_PID_FILE="$RUNTIME_DIR/server.pid"
SERVER_LOG_FILE="$SERVER_WORKDIR/.runtime-server.log"
SERVER_ERR_FILE="$SERVER_WORKDIR/.runtime-server.err.log"
SERVER_ENTRYPOINT="$SERVER_WORKDIR/dist/src/main.js"
SERVER_START_CMD="${OKR_SERVER_START_CMD:-node dist/src/main.js}"

mkdir -p "$RUNTIME_DIR"

if [[ ! -f "$SERVER_ENTRYPOINT" ]]; then
  echo "Server build not found at $SERVER_ENTRYPOINT" >&2
  echo "Run the server build before using scripts/linux/start-stack.sh." >&2
  exit 1
fi

if [[ -f "$SERVER_PID_FILE" ]] && [[ -s "$SERVER_PID_FILE" ]]; then
  EXISTING_PID="$(cat "$SERVER_PID_FILE")"
  if kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    echo "Server already running with PID $EXISTING_PID"
  else
    rm -f "$SERVER_PID_FILE"
  fi
fi

if [[ ! -f "$SERVER_PID_FILE" ]]; then
  (
    cd "$SERVER_WORKDIR"
    nohup bash -lc "$SERVER_START_CMD" > "$SERVER_LOG_FILE" 2> "$SERVER_ERR_FILE" &
    echo $! > "$SERVER_PID_FILE"
  )
fi

"$ROOT_DIR/scripts/linux/start-kkfileview.sh"

echo "Server PID: $(cat "$SERVER_PID_FILE")"
echo "kkFileView expected at: ${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
