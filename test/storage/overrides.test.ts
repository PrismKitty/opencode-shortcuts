import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { KeybindStore } from '#src/host/types.ts';
import { overridingConfigPaths } from '#src/storage/overrides.ts';
import { entry } from '#test/fixtures.ts';

const storeReadingAfter = (laterPaths: readonly string[]): KeybindStore => ({
  path: '/global/tui.json',
  emptyText: '{}',
  appliesAfterRestart: true,
  configKey: (commandID) => commandID.replace('.', '_'),
  defaultBinding: () => undefined,
  pluginShowKeybind: () => undefined,
  withPluginShowKeybind: () => undefined,
  laterConfigPaths: () => laterPaths,
});

const configFiles = async (texts: readonly string[]): Promise<string[]> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
  return Promise.all(
    texts.map(async (text, index) => {
      const configPath = path.join(directory, `tui-${index}.json`);
      await writeFile(configPath, text);
      return configPath;
    }),
  );
};

const switchModel = entry({ title: 'Switch model', commandID: 'model.list' });

describe('overridingConfigPaths', () => {
  it('names the last later file that sets the changed key, since that one wins', async () => {
    const paths = await configFiles([
      '{ "keybinds": { "model_list": "f7" } }',
      '{ "keybinds": { "model_list": "f8" } }',
      '{ "keybinds": { "session_new": "f9" } }',
    ]);
    const changes = [{ entry: switchModel, sequences: ['f6'] }];
    assert.deepEqual(await overridingConfigPaths(storeReadingAfter(paths), changes), [paths[1]]);
  });
  it('finds nothing when no later file sets the key, or the file is missing', async () => {
    const paths = await configFiles(['{ "keybinds": { "session_new": "f9" } }']);
    const changes = [{ entry: switchModel, sequences: ['f6'] }];
    assert.deepEqual(await overridingConfigPaths(storeReadingAfter([...paths, '/missing/tui.json']), changes), [
      undefined,
    ]);
  });
});
