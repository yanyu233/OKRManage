#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KKFILEVIEW_HOME="${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
KKFILEVIEW_BIN_DIR="$KKFILEVIEW_HOME/bin"
KKFILEVIEW_START_SCRIPT="$KKFILEVIEW_BIN_DIR/startup.sh"

if [[ ! -f "$KKFILEVIEW_START_SCRIPT" ]]; then
  echo "kkFileView distribution not found at: $KKFILEVIEW_START_SCRIPT" >&2
  echo "Place the official Linux package contents under vendor/kkfileview/current before starting." >&2
  exit 1
fi

chmod +x "$KKFILEVIEW_START_SCRIPT"
mkdir -p "$ROOT_DIR/apps/server/storage/kkfileview-cache"

export KK_SERVER_PORT="${KK_SERVER_PORT:-8012}"
export KK_CONTEXT_PATH="${KK_CONTEXT_PATH:-/}"
export KK_BASE_URL="${KK_BASE_URL:-http://127.0.0.1:3000/preview}"
export KK_TRUST_HOST="${KK_TRUST_HOST:-127.0.0.1,localhost}"
export KK_NOT_TRUST_HOST="${KK_NOT_TRUST_HOST:-default}"
export KK_FILE_DIR="${KK_FILE_DIR:-$ROOT_DIR/apps/server/storage/kkfileview-cache}"
export KK_CACHE_ENABLED="${KK_CACHE_ENABLED:-true}"
export KK_OFFICE_HOME="${KK_OFFICE_HOME:-default}"

(
  cd "$KKFILEVIEW_BIN_DIR"
  ./startup.sh
)
