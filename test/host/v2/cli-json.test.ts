import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cliJsonStore } from '#src/host/v2/cli-json.ts';
import { configuredKeybind } from '#src/storage/config-file.ts';

const CONFIG = `{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "./plugins/other",
    "opencode-shortcuts"
  ],
}
`;

const store = cliJsonStore((specification) => specification === 'opencode-shortcuts');

describe('cliJsonStore', () => {
  it("names OpenCode's built-in commands by their own ID", () => {
    assert.equal(store.configKey('model.list'), 'model.list');
  });
  it('has no key for commands that other plugins register', () => {
    assert.equal(store.configKey('example.todo.settings'), undefined);
  });
  it('matches whole namespaces, so a plugin named after one has no key', () => {
    assert.equal(store.configKey('opencode-other.show'), undefined);
  });
});

describe('withPluginShowKeybind', () => {
  it('turns a plain plugin entry into one carrying the keybind option', () => {
    const text = store.withPluginShowKeybind(CONFIG, 'f7') ?? '';
    assert.equal(store.pluginShowKeybind(text), 'f7');
    assert.match(text, /"\.\/plugins\/other"/);
  });
  it('removes only the option when resetting', () => {
    const text = store.withPluginShowKeybind(store.withPluginShowKeybind(CONFIG, 'f7') ?? '', undefined) ?? '';
    assert.equal(store.pluginShowKeybind(text), undefined);
  });
  it('gives up when cli.json does not list the plugin', () => {
    assert.equal(store.withPluginShowKeybind('{}', 'f7'), undefined);
  });
});

describe('configuredKeybind', () => {
  it('follows the keybind option in cli.json', () => {
    const text = store.withPluginShowKeybind(CONFIG, 'f7') ?? '';
    assert.equal(configuredKeybind(store, text, 'ctrl+/'), 'f7');
  });
  it('falls back to the starting key once the option is gone', () => {
    assert.equal(configuredKeybind(store, CONFIG, 'ctrl+/'), 'ctrl+/');
  });
  it('turns the key off for none', () => {
    const text = store.withPluginShowKeybind(CONFIG, 'none') ?? '';
    assert.equal(configuredKeybind(store, text, 'ctrl+/'), false);
  });
});
