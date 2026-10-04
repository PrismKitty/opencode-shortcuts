#!/usr/bin/env bash
# Usage: scripts/host/v1/dev.sh [version] [opencode arguments...]
# scripts/host/v2/dev.sh for OpenCode v1. v1 shares its data paths with v2's database, so every XDG directory is scratch.
set -euo pipefail

version=${1:-1.18.34}
shift $(($# > 0))
repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
download="${TMPDIR:-/tmp}/opencode-v1-${version}"

if [[ ! -x "${download}/package/bin/opencode" ]]; then
  mkdir -p "${download}"
  curl -fsSL "https://registry.npmjs.org/opencode-linux-x64/-/opencode-linux-x64-${version}.tgz" | tar xz -C "${download}"
fi
pnpm --dir "${repository}" --silent build

scratch=$(mktemp -d "${TMPDIR:-/tmp}/opencode-shortcuts-dev-v1.XXXXXX")
trap 'rm -rf "${scratch}"' EXIT
for directory in config data cache state; do
  export "XDG_${directory^^}_HOME=${scratch}/${directory}"
done

mkdir -p "${XDG_CONFIG_HOME}/opencode"
cat > "${XDG_CONFIG_HOME}/opencode/tui.json" <<JSON
{
  "\$schema": "https://opencode.ai/tui.json",
  "plugin": ["${repository}"]
}
JSON
echo "Scratch tui.json: ${XDG_CONFIG_HOME}/opencode/tui.json" >&2

"${download}/package/bin/opencode" "$@"
