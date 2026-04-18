#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
WEB_PID_FILE="$RUNTIME_DIR/web.pid"

stop_pid_file() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]] || [[ ! -s "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" || true
  fi

  rm -f "$pid_file"
}

stop_pid_file "$WEB_PID_FILE"
"$ROOT_DIR/scripts/linux/stop-stack.sh"
