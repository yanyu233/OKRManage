#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codex-runtime/linux"
SERVER_DIR="$ROOT_DIR/apps/server"
WEB_DIR="$ROOT_DIR/apps/web"
WEB_PID_FILE="$RUNTIME_DIR/web.pid"
WEB_LOG_FILE="$WEB_DIR/.runtime-web.log"
WEB_ERR_FILE="$WEB_DIR/.runtime-web.err.log"
WEB_DIST_DIR="$WEB_DIR/dist"
WEB_PORT="${OKR_WEB_PORT:-4173}"
MYSQL_SERVICE_NAME="${OKR_MYSQL_SERVICE_NAME:-mysql}"
SERVER_ENV_FILE="${OKR_SERVER_ENV_FILE:-$SERVER_DIR/.env.local}"
SERVER_URL="${OKR_SERVER_URL:-http://127.0.0.1:3000}"
WEB_URL="${OKR_WEB_URL:-http://127.0.0.1:${WEB_PORT}}"
WEB_START_CMD="${OKR_WEB_START_CMD:-npm run preview -- --host 0.0.0.0 --port ${WEB_PORT}}"

mkdir -p "$RUNTIME_DIR"

log() {
  printf '[start-all] %s\n' "$*"
}

warn() {
  printf '[start-all] WARN: %s\n' "$*" >&2
}

run_privileged() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  warn "Current user is not root and sudo is unavailable: $*"
  return 1
}

start_mysql_service_best_effort() {
  if [[ "${OKR_AUTO_START_MYSQL:-1}" != '1' ]]; then
    return
  fi

  if ! command -v systemctl >/dev/null 2>&1; then
    return
  fi

  if systemctl list-unit-files | grep -q "^${MYSQL_SERVICE_NAME}\.service"; then
    run_privileged systemctl start "$MYSQL_SERVICE_NAME" || warn "Failed to start ${MYSQL_SERVICE_NAME}; please inspect manually"
    return
  fi

  if systemctl list-unit-files | grep -q '^mariadb\.service'; then
    run_privileged systemctl start mariadb || warn 'Failed to start mariadb; please inspect manually'
  fi
}

ensure_server_env() {
  if [[ -f "$SERVER_ENV_FILE" ]]; then
    return
  fi

  if [[ -f "$SERVER_DIR/.env.example" ]]; then
    cp "$SERVER_DIR/.env.example" "$SERVER_ENV_FILE"
    warn "Server env file was missing, copied template to: $SERVER_ENV_FILE"
    return
  fi

  warn "Server env file not found: $SERVER_ENV_FILE"
}

prepare_runtime() {
  ensure_server_env
  start_mysql_service_best_effort

  if [[ "${OKR_PRISMA_GENERATE_BEFORE_START:-1}" == '1' ]]; then
    log 'Generating Prisma Client'
    (
      cd "$SERVER_DIR"
      npx prisma generate
    )
  fi

  if [[ "${OKR_MIGRATE_BEFORE_START:-1}" == '1' ]]; then
    log 'Running Prisma migrate deploy'
    (
      cd "$SERVER_DIR"
      npx prisma migrate deploy
    )
  fi

  if [[ "${OKR_BUILD_BEFORE_START:-1}" == '1' ]]; then
    log 'Building server'
    (
      cd "$SERVER_DIR"
      npm run build
    )

    log 'Building web'
    (
      cd "$WEB_DIR"
      VITE_API_BASE_URL="${VITE_API_BASE_URL:-${SERVER_URL}/api}" npm run build
    )
  fi
}

ensure_web_not_running() {
  if [[ -f "$WEB_PID_FILE" ]] && [[ -s "$WEB_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$WEB_PID_FILE")"
    if kill -0 "$existing_pid" >/dev/null 2>&1; then
      log "Web preview is already running with PID $existing_pid"
      return 1
    fi
    rm -f "$WEB_PID_FILE"
  fi

  return 0
}

start_web_preview() {
  if [[ "${OKR_START_WEB:-1}" != '1' ]]; then
    log 'Skipping web preview because OKR_START_WEB=0'
    return
  fi

  if [[ ! -d "$WEB_DIST_DIR" ]]; then
    warn "Web build directory does not exist: $WEB_DIST_DIR"
    return
  fi

  if ! ensure_web_not_running; then
    return
  fi

  log "Starting web preview: ${WEB_START_CMD}"
  (
    cd "$WEB_DIR"
    nohup bash -lc "$WEB_START_CMD" > "$WEB_LOG_FILE" 2> "$WEB_ERR_FILE" &
    echo $! > "$WEB_PID_FILE"
  )
}

main() {
  prepare_runtime
  "$ROOT_DIR/scripts/linux/start-stack.sh"
  start_web_preview

  log "Server URL: ${SERVER_URL}"
  log "Web URL: ${WEB_URL}"
  log "kkFileView proxy URL: ${SERVER_URL}/preview"
  if [[ -f "$WEB_PID_FILE" ]]; then
    log "Web PID: $(cat "$WEB_PID_FILE")"
  fi
}

main "$@"
