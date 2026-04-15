#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
KKFILEVIEW_HOME="${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
KKFILEVIEW_BIN_DIR="$KKFILEVIEW_HOME/bin"
KKFILEVIEW_STOP_SCRIPT="$KKFILEVIEW_BIN_DIR/shutdown.sh"
KKFILEVIEW_PID_FILE="$RUNTIME_DIR/kkfileview.pid"
UPSTREAM_PID_FILE="$KKFILEVIEW_BIN_DIR/kkFileView.pid"

stop_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]] && [[ -s "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" || true
    fi
    rm -f "$pid_file"
  fi
}

if [[ -f "$KKFILEVIEW_STOP_SCRIPT" ]]; then
  chmod +x "$KKFILEVIEW_STOP_SCRIPT"
  (
    cd "$KKFILEVIEW_BIN_DIR"
    ./shutdown.sh || true
  )
fi

stop_pid_file "$UPSTREAM_PID_FILE"
stop_pid_file "$KKFILEVIEW_PID_FILE"
