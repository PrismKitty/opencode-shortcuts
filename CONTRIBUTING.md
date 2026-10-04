# Contributing

## Setup

The repo carries a `shell.nix` with Node 24 and pnpm. `pnpm check` checks formatting, types and the layer order, then runs the tests, which cover everything outside the Solid components.

## Layout

`src/` is layered, and each layer imports only from the ones below it:

| Layer                          | Holds                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tui.tsx`                      | The plugin entry point, which hands v1 and v2 each their own `setup.tsx`                                                                                                                                           |
| `host/v1/`, `host/v2/`         | One OpenCode version's `setup.tsx`, `host.ts` adapter, config file store (`tui-json.ts` or `cli-json.ts`) and `generated/` table. Regenerate a table with its `pnpm update:` script rather than editing it by hand |
| `ui/`                          | `index.tsx` registers the command. `components/` holds the views, `rebinding/` the rebind flow, and `columns/` the column layout and selection                                                                     |
| `storage/`                     | Reading and editing config files, and saving a rebind                                                                                                                                                              |
| `shortcuts/`                   | Commands, keys and rebind planning                                                                                                                                                                                 |
| `host/types.ts`                | What each OpenCode version provides: the `Host` adapter and the `KeybindStore` for its config file                                                                                                                 |
| `plugin-ids.ts`, `settings.ts` | The IDs the plugin registers with OpenCode, and the settings users change through the plugin's `options`                                                                                                           |

Code outside `ui/` imports from `ui/` only through `ui/index.tsx`. Only `tui.tsx` imports a version folder, and only through its `setup.tsx`. The version folders never import each other, nothing shared imports them, and each version's plugin API package is imported only inside its own folder. So removing v1 means deleting `src/host/v1/`, `scripts/host/v1/` and `test/host/v1/`, and the `tui:` line in `tui.tsx`. `.dependency-cruiser.cjs` states these rules, and `pnpm check` fails on an import that breaks one.

## Generated tables

- On v2, the cheatsheet recognises built-in commands by their namespace, the part of the ID before the first dot, such as `session` in `session.new`. It checks against a list taken from OpenCode's `cli.json` schema. If a new OpenCode release adds a namespace, `pnpm update:namespaces` refreshes the list
- On v1, `tui.json` names keys differently from the commands, such as `command_list` for `command.palette.show`. The cheatsheet maps between them with a table taken from v1's source, at the version of the `@opencode-ai/plugin` dev dependency. A command missing from the table shows its keys but can't be rebound, and `pnpm update:v1-keybinds` refreshes the table

## Running it

`pnpm dev` starts OpenCode with this checkout as its only TUI plugin, in a scratch config directory that's deleted on exit. Rebinds you make while testing land in that scratch `cli.json`, never in yours. The scratch `cli.json` points at the checkout's `src/` folder, so OpenCode compiles the TypeScript source itself through `src/tui.tsx`. To load the checkout in your everyday setup instead, point your own `cli.json` at the same folder:

```json
{ "plugins": ["/path/to/opencode-shortcuts/src"] }
```

`pnpm dev:v1 [version]` does the same for OpenCode v1, defaulting to 1.18.34. The script downloads that v1 binary once, builds `tui/`, and runs v1 with its config, data, cache and state all in a scratch directory, because v1 shares its data paths with v2's database.

## The npm build

The npm package needs a build step. OpenCode doesn't compile anything installed from npm, so `pnpm build` compiles `src/` into `tui/` with the same Solid options OpenCode uses for local plugins. It also points every `solid-js` and `@opentui/solid` import at OpenCode's own copies through their `opentui:runtime-module:` ids. Without that, the plugin loads a second Solid runtime and either crashes with "No renderer found" or never repaints ([anomalyco/opencode#39986](https://github.com/anomalyco/opencode/issues/39986)). The build writes `src/tui.tsx` out as `tui/index.js`, because v2 ignores `exports` in `package.json` and loads only a root `tui.*` file or `tui/index.*`. v1 finds the same file through `exports`. `pnpm pack` and `pnpm publish` run the checks and the build first.

## The demo

`pnpm demo` re-records `docs/readme/demo.gif`. It drives a scratch OpenCode, loaded with this checkout and with its own config directory, through tmux. It needs OpenCode installed, and `shell.nix` provides the rest.
