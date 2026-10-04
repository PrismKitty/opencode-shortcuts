import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { laterTuiConfigPaths, tuiJsonStore } from '#src/host/v1/tui-json.ts';
import { configuredKeybind } from '#src/storage/config-file.ts';

const CONFIG = `{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "./plugins/other",
    "opencode-shortcuts"
  ],
}
`;

const isShortcuts = (specification: string): boolean => specification === 'opencode-shortcuts';

const store = tuiJsonStore(isShortcuts);

const storeInConfigHome = async (fileNames: readonly string[]) => {
  const configHome = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
  await mkdir(path.join(configHome, 'opencode'));
  await Promise.all(fileNames.map((fileName) => writeFile(path.join(configHome, 'opencode', fileName), '{}')));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = configHome;
  const configuredStore = tuiJsonStore(isShortcuts);
  process.env.XDG_CONFIG_HOME = previous;
  return configuredStore;
};

describe('tuiJsonStore', () => {
  it("names a command by v1's tui.json key, which is not always a plain rename", () => {
    assert.equal(store.configKey('session.list'), 'session_list');
    assert.equal(store.configKey('command.palette.show'), 'command_list');
  });
  it('keeps the dotted keys v1 reads as they are', () => {
    assert.equal(store.configKey('dialog.select.prev'), 'dialog.select.prev');
  });
  it('has no key for commands that other plugins register', () => {
    assert.equal(store.configKey('example.todo.settings'), undefined);
  });
  it("knows v1's default binding", () => {
    assert.equal(store.defaultBinding('command.palette.show'), 'ctrl+p');
  });
  it('saves to tui.json when there is no tui.jsonc', async () => {
    assert.equal(path.basename((await storeInConfigHome([])).path), 'tui.json');
  });
  it('saves to tui.jsonc when it exists, since v1 reads it last', async () => {
    assert.equal(path.basename((await storeInConfigHome(['tui.json', 'tui.jsonc'])).path), 'tui.jsonc');
  });
});

describe('tui.json withPluginShowKeybind', () => {
  it('turns a plain plugin entry into a pair carrying the keybind option', () => {
    const text = store.withPluginShowKeybind(CONFIG, 'f7') ?? '';
    assert.equal(store.pluginShowKeybind(text), 'f7');
    assert.match(text, /\[\s*"opencode-shortcuts",\s*\{/);
    assert.match(text, /"\.\/plugins\/other"/);
  });
  it('removes only the option when resetting', () => {
    const text = store.withPluginShowKeybind(store.withPluginShowKeybind(CONFIG, 'f7') ?? '', undefined) ?? '';
    assert.equal(store.pluginShowKeybind(text), undefined);
    assert.equal(configuredKeybind(store, text, 'ctrl+/'), 'ctrl+/');
  });
  it('gives up when tui.json does not list the plugin', () => {
    assert.equal(store.withPluginShowKeybind('{}', 'f7'), undefined);
  });
});

describe('laterTuiConfigPaths', () => {
  it('lists project files root first, then .opencode folders nearest first, then the home folder', () => {
    assert.deepEqual(laterTuiConfigPaths('/work/project', '/home/user', {}), [
      '/tui.json',
      '/tui.jsonc',
      '/work/tui.json',
      '/work/tui.jsonc',
      '/work/project/tui.json',
      '/work/project/tui.jsonc',
      '/work/project/.opencode/tui.json',
      '/work/project/.opencode/tui.jsonc',
      '/work/.opencode/tui.json',
      '/work/.opencode/tui.jsonc',
      '/.opencode/tui.json',
      '/.opencode/tui.jsonc',
      '/home/user/.opencode/tui.json',
      '/home/user/.opencode/tui.jsonc',
    ]);
  });
  it('reads OPENCODE_TUI_CONFIG first and OPENCODE_CONFIG_DIR last', () => {
    const paths = laterTuiConfigPaths('/', '/home/user', {
      OPENCODE_TUI_CONFIG: '/custom/tui.json',
      OPENCODE_CONFIG_DIR: '/custom/config',
    });
    assert.equal(paths[0], '/custom/tui.json');
    assert.deepEqual(paths.slice(-2), ['/custom/config/tui.json', '/custom/config/tui.jsonc']);
  });
  it('skips project files when OPENCODE_DISABLE_PROJECT_CONFIG is on', () => {
    assert.deepEqual(laterTuiConfigPaths('/work/project', '/home/user', { OPENCODE_DISABLE_PROJECT_CONFIG: 'true' }), [
      '/home/user/.opencode/tui.json',
      '/home/user/.opencode/tui.jsonc',
    ]);
  });
});
