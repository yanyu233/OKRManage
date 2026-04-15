#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
KKFILEVIEW_HOME="${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
KKFILEVIEW_BIN_DIR="$KKFILEVIEW_HOME/bin"
KKFILEVIEW_CONFIG_FILE="${KKFILEVIEW_CONFIG_FILE:-$KKFILEVIEW_HOME/config/application.properties}"
KKFILEVIEW_JAR="${KKFILEVIEW_JAR:-$KKFILEVIEW_HOME/kkFileView.jar}"
KKFILEVIEW_START_SCRIPT="$KKFILEVIEW_BIN_DIR/startup.sh"
KKFILEVIEW_PID_FILE="$RUNTIME_DIR/kkfileview.pid"
KKFILEVIEW_LOG_FILE="${KKFILEVIEW_LOG_FILE:-$KKFILEVIEW_HOME/log/kkFileView.log}"

mkdir -p "$RUNTIME_DIR"

if [[ -f "$KKFILEVIEW_PID_FILE" ]] && [[ -s "$KKFILEVIEW_PID_FILE" ]]; then
  KKFILEVIEW_PID="$(cat "$KKFILEVIEW_PID_FILE")"
  if kill -0 "$KKFILEVIEW_PID" >/dev/null 2>&1; then
    echo "kkFileView already running with PID $KKFILEVIEW_PID"
    exit 0
  fi
  rm -f "$KKFILEVIEW_PID_FILE"
fi

mkdir -p "$ROOT_DIR/apps/server/storage/kkfileview-cache"
mkdir -p "$(dirname "$KKFILEVIEW_LOG_FILE")"

export KK_SERVER_PORT="${KK_SERVER_PORT:-8012}"
export KK_CONTEXT_PATH="${KK_CONTEXT_PATH:-/}"
export KK_BASE_URL="${KK_BASE_URL:-http://127.0.0.1:3000/preview}"
export KK_TRUST_HOST="${KK_TRUST_HOST:-127.0.0.1,localhost}"
export KK_NOT_TRUST_HOST="${KK_NOT_TRUST_HOST:-default}"
export KK_FILE_DIR="${KK_FILE_DIR:-$ROOT_DIR/apps/server/storage/kkfileview-cache}"
export KK_CACHE_ENABLED="${KK_CACHE_ENABLED:-true}"
export KK_OFFICE_HOME="${KK_OFFICE_HOME:-default}"

if [[ -f "$KKFILEVIEW_JAR" ]]; then
  if ! command -v java >/dev/null 2>&1; then
    echo "java not found. Install JDK or JRE before starting kkFileView." >&2
    exit 1
  fi

  if [[ ! -f "$KKFILEVIEW_CONFIG_FILE" ]]; then
    echo "kkFileView config not found at: $KKFILEVIEW_CONFIG_FILE" >&2
    echo "Build and stage kkFileView with scripts/linux/build-kkfileview-from-source.sh first." >&2
    exit 1
  fi

  (
    cd "$KKFILEVIEW_HOME"
    nohup java -Dfile.encoding=UTF-8 -Dspring.config.location="$KKFILEVIEW_CONFIG_FILE" -jar "$KKFILEVIEW_JAR" > "$KKFILEVIEW_LOG_FILE" 2>&1 &
    echo $! > "$KKFILEVIEW_PID_FILE"
  )

  echo "kkFileView started from staged source build: $KKFILEVIEW_JAR"
  echo "kkFileView PID: $(cat "$KKFILEVIEW_PID_FILE")"
  exit 0
fi

if [[ ! -f "$KKFILEVIEW_START_SCRIPT" ]]; then
  echo "kkFileView runtime not found." >&2
  echo "Expected either $KKFILEVIEW_JAR or $KKFILEVIEW_START_SCRIPT" >&2
  echo "Build and stage kkFileView with scripts/linux/build-kkfileview-from-source.sh first." >&2
  exit 1
fi

chmod +x "$KKFILEVIEW_START_SCRIPT"

(
  cd "$KKFILEVIEW_BIN_DIR"
  ./startup.sh
)

UPSTREAM_PID_FILE="$KKFILEVIEW_BIN_DIR/kkFileView.pid"
if [[ -f "$UPSTREAM_PID_FILE" ]] && [[ -s "$UPSTREAM_PID_FILE" ]]; then
  cp "$UPSTREAM_PID_FILE" "$KKFILEVIEW_PID_FILE"
  echo "kkFileView PID: $(cat "$KKFILEVIEW_PID_FILE")"
fi
