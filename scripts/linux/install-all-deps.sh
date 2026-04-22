#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$ROOT_DIR/apps/server"
WEB_DIR="$ROOT_DIR/apps/web"
SERVER_ENV_FILE="${OKR_SERVER_ENV_FILE:-$SERVER_DIR/.env.local}"
NODE_MAJOR="${OKR_NODE_MAJOR:-20}"
MYSQL_SERVICE_NAME="${OKR_MYSQL_SERVICE_NAME:-mysql}"
KKFILEVIEW_SOURCE_DIR="${OKR_KKFILEVIEW_SOURCE_DIR:-$ROOT_DIR/vendor/kkfileview/source/kkFileView}"
KKFILEVIEW_ARCHIVE_PRIMARY="${OKR_KKFILEVIEW_ARCHIVE_PRIMARY:-$ROOT_DIR/kkFileView-4.4.0.zip}"
KKFILEVIEW_ARCHIVE_FALLBACK="${OKR_KKFILEVIEW_ARCHIVE_FALLBACK:-$ROOT_DIR/kkFileView-main.zip}"

log() {
  printf '[install-all-deps] %s\n' "$*"
}

warn() {
  printf '[install-all-deps] WARN: %s\n' "$*" >&2
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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "Missing command: $1"
    return 1
  fi
}

find_mysql_service_name() {
  local candidate
  local -a candidates=("$MYSQL_SERVICE_NAME" mysql mysqld mariadb)

  for candidate in "${candidates[@]}"; do
    if systemctl list-unit-files | grep -q "^${candidate}\.service"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

ensure_apt_environment() {
  require_command apt-get
  run_privileged apt-get update
  run_privileged apt-get install -y ca-certificates curl gnupg unzip xz-utils git build-essential lsof fontconfig
}

install_nodejs() {
  local current_major=''
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p "process.versions.node.split('.')[0]")"
  fi

  if [[ "$current_major" == "$NODE_MAJOR" ]]; then
    log "Node.js major version already satisfies requirement: $(node -v)"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_privileged bash -
  run_privileged apt-get install -y nodejs
  log "Node.js installed: $(node -v)"
  log "npm version: $(npm -v)"
}

install_system_packages() {
  log 'Installing MySQL / Java / Maven / LibreOffice packages'
  run_privileged apt-get install -y \
    mysql-server \
    openjdk-17-jre-headless \
    maven \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-noto-cjk
}

ensure_server_env() {
  if [[ -f "$SERVER_ENV_FILE" ]]; then
    log "Detected server env file: $SERVER_ENV_FILE"
    return
  fi

  if [[ -f "$SERVER_DIR/.env.example" ]]; then
    cp "$SERVER_DIR/.env.example" "$SERVER_ENV_FILE"
    log "Created server env file from template: $SERVER_ENV_FILE"
    warn 'Review DATABASE_URL, APP_BASE_URL and WEB_BASE_URL before production deployment'
    return
  fi

  warn "Server env template not found, skipping initialization: $SERVER_ENV_FILE"
}

load_server_env() {
  if [[ ! -f "$SERVER_ENV_FILE" ]]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  source "$SERVER_ENV_FILE"
  set +a
}

start_mysql_service_best_effort() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  local mysql_service_name=''
  mysql_service_name="$(find_mysql_service_name || true)"
  if [[ -n "$mysql_service_name" ]]; then
    run_privileged systemctl start "$mysql_service_name" || warn "Failed to start ${mysql_service_name}; please inspect manually"
  fi
}

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

provision_local_mysql_database() {
  if [[ "${OKR_SETUP_LOCAL_DATABASE:-1}" != '1' ]]; then
    log 'Skipping local database bootstrap because OKR_SETUP_LOCAL_DATABASE=0'
    return
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    warn 'DATABASE_URL is missing; skipping local database bootstrap'
    return
  fi

  mapfile -t db_fields < <(
    DATABASE_URL="$DATABASE_URL" node <<'NODE'
const raw = process.env.DATABASE_URL;
const parsed = new URL(raw);
console.log(parsed.protocol.replace(':', ''));
console.log(parsed.hostname);
console.log(parsed.port || '3306');
console.log(decodeURIComponent(parsed.username || ''));
console.log(decodeURIComponent(parsed.password || ''));
console.log((parsed.pathname || '/').replace(/^\//, ''));
NODE
  )

  local db_protocol="${db_fields[0]:-}"
  local db_host="${db_fields[1]:-}"
  local db_port="${db_fields[2]:-3306}"
  local db_user="${db_fields[3]:-}"
  local db_password="${db_fields[4]:-}"
  local db_name="${db_fields[5]:-}"

  if [[ "$db_protocol" != 'mysql' ]]; then
    warn "DATABASE_URL protocol is not mysql ($db_protocol); skipping database bootstrap"
    return
  fi

  if [[ "$db_host" != '127.0.0.1' && "$db_host" != 'localhost' ]]; then
    log "DATABASE_URL points to remote database $db_host:$db_port; skipping local MySQL bootstrap"
    return
  fi

  if [[ -z "$db_name" ]]; then
    warn 'DATABASE_URL does not contain a database name; skipping database bootstrap'
    return
  fi

  start_mysql_service_best_effort

  local escaped_db_name
  escaped_db_name="$(sql_escape "$db_name")"

  if [[ "$db_user" == 'root' || -z "$db_user" ]]; then
    run_privileged mysql -e "CREATE DATABASE IF NOT EXISTS \`$escaped_db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

    if [[ "${OKR_ALLOW_ROOT_PASSWORD_BOOTSTRAP:-0}" == '1' ]] && [[ -n "$db_password" ]]; then
      local escaped_root_password
      escaped_root_password="$(sql_escape "$db_password")"
      run_privileged mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$escaped_root_password'; FLUSH PRIVILEGES;" || true
      log 'Attempted to set the MySQL root password from DATABASE_URL'
    else
      warn 'DATABASE_URL uses the root account. The script only creates the database and will not change root auth by default.'
    fi

    return
  fi

  local escaped_db_user
  local escaped_db_password
  escaped_db_user="$(sql_escape "$db_user")"
  escaped_db_password="$(sql_escape "$db_password")"

  run_privileged mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$escaped_db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$escaped_db_user'@'localhost' IDENTIFIED BY '$escaped_db_password';
CREATE USER IF NOT EXISTS '$escaped_db_user'@'127.0.0.1' IDENTIFIED BY '$escaped_db_password';
GRANT ALL PRIVILEGES ON \`$escaped_db_name\`.* TO '$escaped_db_user'@'localhost';
GRANT ALL PRIVILEGES ON \`$escaped_db_name\`.* TO '$escaped_db_user'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

  log "Local MySQL database is ready: $db_name"
}

prepare_kkfileview_source() {
  if [[ "${OKR_SETUP_KKFILEVIEW:-1}" != '1' ]]; then
    log 'Skipping kkFileView preparation because OKR_SETUP_KKFILEVIEW=0'
    return
  fi

  if [[ -f "$ROOT_DIR/vendor/kkfileview/current/kkFileView.jar" ]]; then
    log 'Detected staged kkFileView runtime jar; skipping source preparation'
    return
  fi

  if [[ -f "$KKFILEVIEW_SOURCE_DIR/pom.xml" ]]; then
    log "Detected existing kkFileView source directory: $KKFILEVIEW_SOURCE_DIR"
  else
    local archive_path=''
    for candidate in "$KKFILEVIEW_ARCHIVE_PRIMARY" "$KKFILEVIEW_ARCHIVE_FALLBACK"; do
      if [[ -f "$candidate" ]]; then
        archive_path="$candidate"
        break
      fi
    done

    if [[ -z "$archive_path" ]]; then
      warn 'No kkFileView source directory or source archive found; skipping kkFileView build'
      return
    fi

    local source_root="$ROOT_DIR/vendor/kkfileview/source"
    local temp_extract_dir="$source_root/.extract-tmp"

    log "Extracting kkFileView source archive: $archive_path"
    mkdir -p "$source_root"
    rm -rf "$temp_extract_dir"
    mkdir -p "$temp_extract_dir"
    unzip -q -o "$archive_path" -d "$temp_extract_dir"

    local extracted_dir=''
    extracted_dir="$(find "$temp_extract_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
    if [[ -z "$extracted_dir" ]]; then
      warn 'No source directory found after extracting kkFileView archive; skipping build'
      rm -rf "$temp_extract_dir"
      return
    fi

    rm -rf "$KKFILEVIEW_SOURCE_DIR"
    mkdir -p "$(dirname "$KKFILEVIEW_SOURCE_DIR")"
    mv "$extracted_dir" "$KKFILEVIEW_SOURCE_DIR"
    rm -rf "$temp_extract_dir"
  fi

  log 'Building kkFileView and staging the runtime into the project'
  "$ROOT_DIR/scripts/linux/build-kkfileview-from-source.sh" "$KKFILEVIEW_SOURCE_DIR"
}

install_node_dependencies() {
  log 'Installing server npm dependencies'
  (
    cd "$SERVER_DIR"
    npm ci
    npx prisma generate
  )

  log 'Installing web npm dependencies'
  (
    cd "$WEB_DIR"
    npm ci
  )
}

apply_database_migrations() {
  if [[ "${OKR_RUN_MIGRATIONS_ON_INSTALL:-1}" != '1' ]]; then
    log 'Skipping Prisma migrate deploy because OKR_RUN_MIGRATIONS_ON_INSTALL=0'
    return
  fi

  log 'Running Prisma migrate deploy'
  (
    cd "$SERVER_DIR"
    npx prisma migrate deploy
  )
}

seed_database_if_requested() {
  if [[ "${OKR_RUN_SEED:-0}" != '1' ]]; then
    return
  fi

  log 'Running Prisma seed'
  (
    cd "$SERVER_DIR"
    npm run prisma:seed
  )
}

build_apps_if_requested() {
  if [[ "${OKR_BUILD_ON_INSTALL:-1}" != '1' ]]; then
    log 'Skipping build because OKR_BUILD_ON_INSTALL=0'
    return
  fi

  log 'Building server'
  (
    cd "$SERVER_DIR"
    npm run build
  )

  log 'Building web'
  (
    cd "$WEB_DIR"
    npm run build
  )
}

main() {
  ensure_apt_environment
  install_nodejs
  install_system_packages
  ensure_server_env
  load_server_env
  provision_local_mysql_database
  prepare_kkfileview_source
  install_node_dependencies
  apply_database_migrations
  seed_database_if_requested
  build_apps_if_requested
  log 'Dependency installation completed'
}

main "$@"
