#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
SERVER_PID_FILE="$RUNTIME_DIR/server.pid"

"$ROOT_DIR/scripts/linux/stop-kkfileview.sh"

if [[ -f "$SERVER_PID_FILE" ]] && [[ -s "$SERVER_PID_FILE" ]]; then
  SERVER_PID="$(cat "$SERVER_PID_FILE")"
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" || true
  fi
  rm -f "$SERVER_PID_FILE"
fi
