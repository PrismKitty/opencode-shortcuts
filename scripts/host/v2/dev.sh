#!/usr/bin/env bash
# Starts OpenCode with this checkout as its only TUI plugin, in a throwaway config directory that is
# deleted on exit, so rebinds made while testing never reach your own cli.json.
# Arguments are passed on to opencode.
set -euo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/opencode-shortcuts-dev.XXXXXX")
trap 'rm -rf "${scratch}"' EXIT

mkdir -p "${scratch}/opencode"
cat > "${scratch}/opencode/cli.json" <<JSON
{
  "\$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["${repository}/src"]
}
JSON
echo "Scratch cli.json: ${scratch}/opencode/cli.json" >&2

XDG_CONFIG_HOME="${scratch}" opencode "$@"
