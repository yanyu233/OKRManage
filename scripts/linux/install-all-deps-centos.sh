#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$ROOT_DIR/apps/server"
WEB_DIR="$ROOT_DIR/apps/web"
SERVER_ENV_FILE="${OKR_SERVER_ENV_FILE:-$SERVER_DIR/.env.local}"
NODE_MAJOR="${OKR_NODE_MAJOR:-20}"
MYSQL_SERVICE_NAME="${OKR_MYSQL_SERVICE_NAME:-mysqld}"
MYSQL_REPO_RPM_URL="${OKR_MYSQL_REPO_RPM_URL:-}"
NODESOURCE_REPO_RPM_URL="${OKR_NODESOURCE_REPO_RPM_URL:-https://rpm.nodesource.com/pub_${NODE_MAJOR}.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm}"
MYSQL_ROOT_PASSWORD="${OKR_MYSQL_ROOT_PASSWORD:-Moutai123.}"
MYSQL_ROOT_HOST="${OKR_MYSQL_ROOT_HOST:-localhost}"
AUTO_CONFIGURE_MYSQL_ROOT_PASSWORD="${OKR_AUTO_CONFIGURE_MYSQL_ROOT_PASSWORD:-1}"
LIBREOFFICE_INSTALL_MODE="${OKR_LIBREOFFICE_INSTALL_MODE:-auto}"
LIBREOFFICE_RPM_ARCHIVE_URL="${OKR_LIBREOFFICE_RPM_ARCHIVE_URL:-}"
LIBREOFFICE_RPM_ARCHIVE_PATH="${OKR_LIBREOFFICE_RPM_ARCHIVE_PATH:-}"
KKFILEVIEW_SOURCE_DIR="${OKR_KKFILEVIEW_SOURCE_DIR:-$ROOT_DIR/vendor/kkfileview/source/kkFileView}"
KKFILEVIEW_ARCHIVE_PRIMARY="${OKR_KKFILEVIEW_ARCHIVE_PRIMARY:-$ROOT_DIR/kkFileView-4.4.0.zip}"
KKFILEVIEW_ARCHIVE_FALLBACK="${OKR_KKFILEVIEW_ARCHIVE_FALLBACK:-$ROOT_DIR/kkFileView-main.zip}"
PACKAGE_MANAGER=''
OS_ID=''
OS_VERSION_ID=''
OS_MAJOR=''
OS_ID_LIKE=''

log() {
  printf '[install-all-deps-centos] %s\n' "$*"
}

warn() {
  printf '[install-all-deps-centos] WARN: %s\n' "$*" >&2
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

load_os_release() {
  if [[ ! -f /etc/os-release ]]; then
    warn 'Missing /etc/os-release'
    return 1
  fi

  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_VERSION_ID="${VERSION_ID:-}"
  OS_MAJOR="${OS_VERSION_ID%%.*}"
  OS_ID_LIKE="${ID_LIKE:-}"
}

detect_package_manager() {
  if command -v dnf >/dev/null 2>&1; then
    PACKAGE_MANAGER='dnf'
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    PACKAGE_MANAGER='yum'
    return
  fi

  warn 'Neither dnf nor yum is available on this host'
  return 1
}

package_install() {
  run_privileged "$PACKAGE_MANAGER" install -y "$@"
}

package_update() {
  run_privileged "$PACKAGE_MANAGER" makecache >/dev/null 2>&1 || true
}

ensure_centos_family() {
  load_os_release
  detect_package_manager

  case "$OS_ID" in
    centos|rhel|rocky|almalinux|ol)
      ;;
    *)
      if [[ "$OS_ID_LIKE" != *rhel* ]]; then
        warn "This script targets CentOS / RHEL compatible distributions, detected: ${OS_ID:-unknown}"
        return 1
      fi
      ;;
  esac

  if [[ -z "$OS_MAJOR" ]]; then
    warn 'Unable to detect the major OS version'
    return 1
  fi

  if [[ "$OS_MAJOR" != '9' && "$OS_MAJOR" != '8' ]]; then
    warn "Detected EL${OS_MAJOR}. This script is written for EL8/EL9, and EL9 is recommended."
  fi
}

ensure_rpm_environment() {
  package_update
  package_install ca-certificates curl unzip xz tar gzip git lsof fontconfig findutils which
  package_install gcc gcc-c++ make

  if [[ "$PACKAGE_MANAGER" == 'dnf' ]]; then
    package_install dnf-plugins-core
  fi

  package_install glibc-langpack-zh || warn 'Unable to install glibc-langpack-zh, continuing'
}

disable_conflicting_modules_if_needed() {
  if [[ "$PACKAGE_MANAGER" != 'dnf' ]]; then
    return
  fi

  run_privileged dnf module disable -y nodejs >/dev/null 2>&1 || true
  run_privileged dnf module disable -y mysql >/dev/null 2>&1 || true
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

  disable_conflicting_modules_if_needed

  log "Installing Node.js ${NODE_MAJOR}.x from NodeSource RPM repository"
  package_install "$NODESOURCE_REPO_RPM_URL"
  run_privileged "$PACKAGE_MANAGER" install -y nodejs --setopt=nodesource-nodejs.module_hotfixes=1
  log "Node.js installed: $(node -v)"
  log "npm version: $(npm -v)"
}

resolve_default_mysql_repo_url() {
  if [[ -n "$MYSQL_REPO_RPM_URL" ]]; then
    printf '%s\n' "$MYSQL_REPO_RPM_URL"
    return 0
  fi

  case "$OS_MAJOR" in
    9)
      printf '%s\n' 'https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm'
      ;;
    8)
      printf '%s\n' 'https://dev.mysql.com/get/mysql84-community-release-el8-1.noarch.rpm'
      ;;
    *)
      warn "No default MySQL Yum repository package is configured for EL${OS_MAJOR}"
      return 1
      ;;
  esac
}

ensure_mysql_repo() {
  if "$PACKAGE_MANAGER" repolist all 2>/dev/null | grep -qi 'mysql'; then
    log 'Detected an existing MySQL repository configuration'
    return
  fi

  local mysql_repo_url=''
  mysql_repo_url="$(resolve_default_mysql_repo_url)"
  log "Installing MySQL Yum repository package: ${mysql_repo_url}"
  package_install "$mysql_repo_url"
}

install_mysql_packages() {
  ensure_mysql_repo
  package_install mysql-community-server
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

start_mysql_service_best_effort() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  local mysql_service_name=''
  mysql_service_name="$(find_mysql_service_name || true)"
  if [[ -n "$mysql_service_name" ]]; then
    run_privileged systemctl enable "$mysql_service_name" >/dev/null 2>&1 || true
    run_privileged systemctl start "$mysql_service_name" || warn "Failed to start ${mysql_service_name}; please inspect manually"
  fi
}

install_java_and_maven() {
  log 'Installing Java 17 and Maven'
  package_install java-17-openjdk java-17-openjdk-devel maven
}

install_libreoffice_from_repo() {
  if package_install libreoffice libreoffice-headless; then
    return 0
  fi

  if package_install libreoffice; then
    return 0
  fi

  return 1
}

install_libreoffice_from_archive() {
  local archive_path=''

  if [[ -n "$LIBREOFFICE_RPM_ARCHIVE_PATH" ]]; then
    if [[ ! -f "$LIBREOFFICE_RPM_ARCHIVE_PATH" ]]; then
      warn "LibreOffice RPM archive not found: $LIBREOFFICE_RPM_ARCHIVE_PATH"
      return 1
    fi
    archive_path="$LIBREOFFICE_RPM_ARCHIVE_PATH"
  elif [[ -n "$LIBREOFFICE_RPM_ARCHIVE_URL" ]]; then
    local download_dir="$ROOT_DIR/.downloads"
    mkdir -p "$download_dir"
    archive_path="$download_dir/$(basename "${LIBREOFFICE_RPM_ARCHIVE_URL%%\?*}")"
    log "Downloading LibreOffice RPM archive: $LIBREOFFICE_RPM_ARCHIVE_URL"
    curl -fL "$LIBREOFFICE_RPM_ARCHIVE_URL" -o "$archive_path"
  else
    return 1
  fi

  local extract_dir="$ROOT_DIR/.downloads/libreoffice-rpm"
  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  tar -xf "$archive_path" -C "$extract_dir"

  local rpm_dir=''
  rpm_dir="$(find "$extract_dir" -type d -name RPMS | head -n 1)"
  if [[ -z "$rpm_dir" ]]; then
    warn "Unable to locate LibreOffice RPMS directory under: $extract_dir"
    return 1
  fi

  log "Installing LibreOffice from archive: $archive_path"
  run_privileged "$PACKAGE_MANAGER" install -y "$rpm_dir"/*.rpm
}

install_libreoffice() {
  if command -v soffice >/dev/null 2>&1; then
    log "LibreOffice already satisfies requirement: $(soffice --version 2>/dev/null | head -n 1)"
    return
  fi

  case "$LIBREOFFICE_INSTALL_MODE" in
    repo-only)
      install_libreoffice_from_repo
      ;;
    official-only)
      install_libreoffice_from_archive
      ;;
    auto)
      if install_libreoffice_from_archive; then
        return
      fi

      warn 'LibreOffice official RPM archive is unavailable, falling back to repository install'
      install_libreoffice_from_repo
      ;;
    *)
      warn "Unsupported OKR_LIBREOFFICE_INSTALL_MODE: $LIBREOFFICE_INSTALL_MODE"
      return 1
      ;;
  esac
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

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

run_mysql_admin() {
  local mysql_host="${OKR_DB_ADMIN_HOST:-127.0.0.1}"
  local mysql_port="${OKR_DB_ADMIN_PORT:-3306}"
  local mysql_user="${OKR_DB_ADMIN_USER:-root}"
  local mysql_password="${OKR_DB_ADMIN_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}"
  local -a mysql_cmd=(mysql "-h${mysql_host}" "-P${mysql_port}" "-u${mysql_user}")

  if [[ -n "$mysql_password" ]]; then
    mysql_cmd+=("-p${mysql_password}")
  fi

  if [[ "${OKR_DB_ADMIN_CONNECT_EXPIRED_PASSWORD:-0}" == '1' ]]; then
    mysql_cmd+=(--connect-expired-password)
  fi

  run_privileged "${mysql_cmd[@]}" "$@"
}

find_mysql_temporary_root_password() {
  local mysql_log_path="${OKR_MYSQL_LOG_PATH:-/var/log/mysqld.log}"

  if [[ ! -f "$mysql_log_path" ]]; then
    return 1
  fi

  grep 'temporary password' "$mysql_log_path" | tail -n 1 | awk '{print $NF}'
}

try_mysql_login() {
  local mysql_user="${1:-root}"
  local mysql_password="${2:-}"
  shift 2 || true
  local -a mysql_cmd=(mysql -u"$mysql_user")

  if [[ -n "$mysql_password" ]]; then
    mysql_cmd+=("-p${mysql_password}")
  fi

  run_privileged "${mysql_cmd[@]}" -e 'SELECT 1;' >/dev/null 2>&1
}

ensure_mysql_root_password() {
  if [[ "${AUTO_CONFIGURE_MYSQL_ROOT_PASSWORD}" != '1' ]]; then
    log 'Skipping MySQL root password initialization because OKR_AUTO_CONFIGURE_MYSQL_ROOT_PASSWORD=0'
    return 0
  fi

  if [[ -z "${MYSQL_ROOT_PASSWORD}" ]]; then
    warn 'MYSQL_ROOT_PASSWORD is empty; skipping MySQL root password initialization'
    return 0
  fi

  if try_mysql_login root "$MYSQL_ROOT_PASSWORD"; then
    log 'MySQL root password already matches the configured value'
    return 0
  fi

  local escaped_root_password
  escaped_root_password="$(sql_escape "$MYSQL_ROOT_PASSWORD")"
  local escaped_root_host
  escaped_root_host="$(sql_escape "$MYSQL_ROOT_HOST")"
  local admin_user="${OKR_DB_ADMIN_USER:-root}"
  local admin_password="${OKR_DB_ADMIN_PASSWORD:-}"
  local temporary_password=''
  temporary_password="$(find_mysql_temporary_root_password || true)"

  if [[ "$admin_user" == 'root' ]] && [[ -n "$admin_password" ]] && [[ "$admin_password" != "$MYSQL_ROOT_PASSWORD" ]]; then
    if run_mysql_admin -e 'SELECT 1;' >/dev/null 2>&1; then
      log 'Configuring MySQL root password from the provided admin credentials'
      if run_mysql_admin <<SQL
ALTER USER 'root'@'${escaped_root_host}' IDENTIFIED BY '${escaped_root_password}';
FLUSH PRIVILEGES;
SQL
      then
        if try_mysql_login root "$MYSQL_ROOT_PASSWORD"; then
          log 'MySQL root password updated successfully from the provided admin credentials'
          return 0
        fi
      fi
    fi
  fi

  if [[ -n "$temporary_password" ]]; then
    log 'Configuring MySQL root password from the temporary bootstrap password'
    if run_privileged mysql --connect-expired-password -uroot "-p${temporary_password}" <<SQL
ALTER USER 'root'@'${escaped_root_host}' IDENTIFIED BY '${escaped_root_password}';
FLUSH PRIVILEGES;
SQL
    then
      if try_mysql_login root "$MYSQL_ROOT_PASSWORD"; then
        log 'MySQL root password configured successfully from the temporary password'
        return 0
      fi
    fi
  fi

  if try_mysql_login root ''; then
    log 'Configuring MySQL root password from the current passwordless root session'
    if run_privileged mysql -uroot <<SQL
ALTER USER 'root'@'${escaped_root_host}' IDENTIFIED BY '${escaped_root_password}';
FLUSH PRIVILEGES;
SQL
    then
      if try_mysql_login root "$MYSQL_ROOT_PASSWORD"; then
        log 'MySQL root password configured successfully from the passwordless root session'
        return 0
      fi
    fi
  fi

  warn 'Unable to initialize the MySQL root password automatically.'
  warn 'If MySQL was already initialized with a different root password, export OKR_DB_ADMIN_PASSWORD with the current value before rerunning.'
  return 1
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

  if ! run_mysql_admin -e 'SELECT 1;' >/dev/null 2>&1; then
    warn 'Unable to log into MySQL with the current admin settings.'
    warn 'For mysql-community-server on CentOS, initialize root first, then export OKR_DB_ADMIN_USER / OKR_DB_ADMIN_PASSWORD and rerun.'
    warn "DATABASE_URL target was ${db_user:-root}@${db_host}:${db_port}/${db_name}; skipping bootstrap"
    return
  fi

  local escaped_db_name
  escaped_db_name="$(sql_escape "$db_name")"

  if [[ "$db_user" == 'root' || -z "$db_user" ]]; then
    run_mysql_admin -e "CREATE DATABASE IF NOT EXISTS \`$escaped_db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    warn 'DATABASE_URL uses the root account. The CentOS script will not rotate the root password automatically.'
    return
  fi

  local escaped_db_user
  local escaped_db_password
  escaped_db_user="$(sql_escape "$db_user")"
  escaped_db_password="$(sql_escape "$db_password")"

  run_mysql_admin <<SQL
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

print_mysql_root_hint_if_needed() {
  if [[ "$MYSQL_SERVICE_NAME" == 'mysqld' ]] || systemctl list-unit-files 2>/dev/null | grep -q '^mysqld\.service'; then
    if try_mysql_login root "$MYSQL_ROOT_PASSWORD"; then
      log "MySQL root password is ready for automation: ${MYSQL_ROOT_PASSWORD}"
      return
    fi

    warn 'If this is a fresh mysql-community-server install, MySQL may have generated a temporary root password.'
    warn "Check it with: sudo grep 'temporary password' /var/log/mysqld.log"
    warn "The CentOS installer will try to reset root to: ${MYSQL_ROOT_PASSWORD}"
  fi
}

main() {
  ensure_centos_family
  ensure_rpm_environment
  install_nodejs
  install_java_and_maven
  install_mysql_packages
  install_libreoffice
  ensure_server_env
  load_server_env
  start_mysql_service_best_effort
  ensure_mysql_root_password
  print_mysql_root_hint_if_needed
  provision_local_mysql_database
  prepare_kkfileview_source
  install_node_dependencies
  apply_database_migrations
  seed_database_if_requested
  build_apps_if_requested
  log 'CentOS dependency installation completed'
}

main "$@"
