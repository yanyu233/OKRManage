#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KKFILEVIEW_HOME="${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
KKFILEVIEW_BIN_DIR="$KKFILEVIEW_HOME/bin"
KKFILEVIEW_STOP_SCRIPT="$KKFILEVIEW_BIN_DIR/shutdown.sh"
KKFILEVIEW_PID_FILE="$KKFILEVIEW_BIN_DIR/kkFileView.pid"

if [[ -f "$KKFILEVIEW_STOP_SCRIPT" ]]; then
  chmod +x "$KKFILEVIEW_STOP_SCRIPT"
  (
    cd "$KKFILEVIEW_BIN_DIR"
    ./shutdown.sh || true
  )
fi

if [[ -f "$KKFILEVIEW_PID_FILE" ]] && [[ -s "$KKFILEVIEW_PID_FILE" ]]; then
  PID="$(cat "$KKFILEVIEW_PID_FILE")"
  if kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" || true
  fi
fi
