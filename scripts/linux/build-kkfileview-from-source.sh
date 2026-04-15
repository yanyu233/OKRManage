#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${1:-${KKFILEVIEW_SOURCE_DIR:-$ROOT_DIR/vendor/kkfileview/source/kkFileView}}"
KKFILEVIEW_HOME="${KKFILEVIEW_HOME:-$ROOT_DIR/vendor/kkfileview/current}"
CONFIG_SOURCE_DIR="$SOURCE_DIR/server/src/main/config"
BIN_SOURCE_DIR="$SOURCE_DIR/server/src/main/bin"
TARGET_DIR="$SOURCE_DIR/server/target"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_command java
require_command mvn

if [[ ! -f "$SOURCE_DIR/pom.xml" ]]; then
  echo "kkFileView source root not found: $SOURCE_DIR/pom.xml" >&2
  exit 1
fi

if [[ ! -d "$CONFIG_SOURCE_DIR" ]]; then
  echo "kkFileView config directory not found: $CONFIG_SOURCE_DIR" >&2
  exit 1
fi

(
  cd "$SOURCE_DIR"
  mvn clean package -DskipTests
)

JAR_PATH="$(find "$TARGET_DIR" -maxdepth 1 -type f -name 'kkFileView-*.jar' ! -name 'original-*' ! -name '*-sources.jar' ! -name '*-javadoc.jar' | sort | tail -n 1)"

if [[ -z "${JAR_PATH:-}" ]]; then
  echo "Unable to find built kkFileView jar under: $TARGET_DIR" >&2
  exit 1
fi

mkdir -p "$KKFILEVIEW_HOME"
find "$KKFILEVIEW_HOME" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
mkdir -p "$KKFILEVIEW_HOME/bin" "$KKFILEVIEW_HOME/config" "$KKFILEVIEW_HOME/log"

cp "$JAR_PATH" "$KKFILEVIEW_HOME/kkFileView.jar"
cp -R "$CONFIG_SOURCE_DIR/." "$KKFILEVIEW_HOME/config/"

if [[ -d "$BIN_SOURCE_DIR" ]] && compgen -G "$BIN_SOURCE_DIR/*.sh" > /dev/null; then
  cp "$BIN_SOURCE_DIR"/*.sh "$KKFILEVIEW_HOME/bin/"
  chmod +x "$KKFILEVIEW_HOME"/bin/*.sh
fi

if [[ -f "$SOURCE_DIR/LICENSE" ]]; then
  cp "$SOURCE_DIR/LICENSE" "$KKFILEVIEW_HOME/LICENSE"
fi

if git -C "$SOURCE_DIR" rev-parse HEAD >/dev/null 2>&1; then
  git -C "$SOURCE_DIR" rev-parse HEAD > "$KKFILEVIEW_HOME/SOURCE_COMMIT"
fi

printf '%s\n' "$(basename "$JAR_PATH")" > "$KKFILEVIEW_HOME/UPSTREAM_JAR_NAME"
touch "$KKFILEVIEW_HOME/.gitkeep"

echo "kkFileView staged into: $KKFILEVIEW_HOME"
echo "Using source checkout: $SOURCE_DIR"
echo "Built jar: $(basename "$JAR_PATH")"
