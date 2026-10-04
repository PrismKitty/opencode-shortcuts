#!/usr/bin/env bash
# Records the README demo into docs/readme/demo.gif by running scripts/host/v2/dev.sh under asciinema, in a tmux
# session driven from here. Needs opencode on PATH, plus tmux, asciinema and agg, which shell.nix provides.
set -euo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=${TMPDIR:-/tmp}/opencode-shortcuts-demo
socket=${work}/tmux.sock
cast=${work}/demo.cast
home=${work}/home
project=${home}/projects/my-project
columns=120
rows=36
prompt_placeholder='Ask anything'
startup_timeout=60

in_demo() {
    tmux -S "${socket}" "$@"
}

say() {
    echo "==> $*"
}

# usage: press <seconds to linger after each key> <key>...
press() {
    local linger=$1
    shift
    local key
    for key in "$@"; do
        in_demo send-keys "${key}"
        sleep "${linger}"
    done
}

type_slowly() {
    local text=$1
    local index
    for (( index = 0; index < ${#text}; index++ )); do
        in_demo send-keys -l "${text:index:1}"
        sleep 0.12
    done
    sleep 0.8
}

wait_until_ready() {
    local deadline=$(( SECONDS + startup_timeout ))
    until in_demo capture-pane -p 2>/dev/null | grep -qF "${prompt_placeholder}"; do
        if (( SECONDS >= deadline )); then
            echo "OpenCode didn't start within ${startup_timeout}s" >&2
            exit 1
        fi
        sleep 0.2
    done
    sleep 1.5
}

prepare() {
    say "Preparing a scratch project in ${project}"
    in_demo kill-server 2>/dev/null || true
    rm -rf "${work}"
    mkdir -p "${project}"
    git -C "${project}" init -q -b main
    # OpenCode shows the model under the prompt, so pin OpenCode's own free one rather than whatever you last used
    cat > "${project}/opencode.json" <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/big-pickle"
}
JSON
}

start_recording() {
    say "Starting OpenCode under asciinema, ${columns}x${rows}"
    local session=(
        new-session -d
        -x "${columns}" -y "${rows}"
        -e TERM=xterm-256color
        # A private server under the scratch HOME loads none of the user's global config, plugins or
        # commands, and OpenCode shows the project as ~/projects/my-project
        -e "HOME=${home}"
        -e "XDG_DATA_HOME=${home}/.local/share"
        -e "XDG_STATE_HOME=${home}/.local/state"
        -e "XDG_CACHE_HOME=${home}/.cache"
        -c "${project}"
        "asciinema rec --quiet --overwrite --window-size ${columns}x${rows} -c '${repository}/scripts/host/v2/dev.sh --standalone 2>/dev/null' ${cast}"
    )
    in_demo -f /dev/null \
        start-server \; \
        set -s extended-keys always \; \
        set -s extended-keys-format csi-u \; \
        "${session[@]}"
    say "Waiting for OpenCode to be ready (up to ${startup_timeout}s)"
    wait_until_ready
}

perform() {
    say "Opening the cheatsheet and browsing"
    press 1.6 C-_
    press 0.35 Down Down Down
    press 1.0 Up
    say "Rebinding Switch model to f6"
    type_slowly model
    press 1.2 C-r
    press 1.8 F6
    press 3.5 Enter
    say "Rebinding Show command palette to ctrl+x k"
    press 0.4 C-u
    type_slowly palette
    press 1.2 C-r
    press 1.4 C-x
    press 1.8 k
    press 3.5 Enter
    say "Resetting Switch model"
    press 0.4 C-u
    type_slowly model
    press 2.2 C-d
    press 3.5 Enter
    say "Closing the cheatsheet"
    press 1.5 Escape
}

quit_opencode() {
    say "Quitting OpenCode"
    local attempt
    for (( attempt = 0; attempt < 10; attempt++ )); do
        in_demo send-keys C-c 2>/dev/null || return 0
        sleep 1
    done
    echo "OpenCode didn't quit" >&2
    exit 1
}

render() {
    local font_options=(--font-family "DejaVu Sans Mono")
    if [[ -n "${DEMO_FONT_DIR:-}" ]]; then
        font_options+=(--font-dir "${DEMO_FONT_DIR}")
    fi
    say "Trimming OpenCode's exit from the recording"
    "${repository}/scripts/trim-cast.ts" "${cast}" "${work}/trimmed.cast"
    say "Rendering docs/readme/demo.gif"
    agg "${font_options[@]}" "${work}/trimmed.cast" "${repository}/docs/readme/demo.gif" >/dev/null
}

prepare
start_recording
perform
quit_opencode
render
echo "Wrote docs/readme/demo.gif"
