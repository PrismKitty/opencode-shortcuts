import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { KeybindStore } from '#src/host/types.ts';
import { saveAndVerify } from '#src/storage/save.ts';

const scratchConfig = async (text: string): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
  const configPath = path.join(directory, 'cli.json');
  await writeFile(configPath, text);
  return configPath;
};

const storeAt = (configPath: string): KeybindStore => ({
  path: configPath,
  emptyText: '{}',
  appliesAfterRestart: false,
  configKey: (commandID) => commandID,
  defaultBinding: () => undefined,
  pluginShowKeybind: () => undefined,
  withPluginShowKeybind: () => undefined,
  laterConfigPaths: () => [],
});

describe('saveAndVerify', () => {
  it('keeps the edit once it is applied, and passes every write on', async () => {
    const configPath = await scratchConfig('{}');
    const written: string[] = [];
    const outcome = await saveAndVerify({
      store: storeAt(configPath),
      edit: () => '{"edited":true}',
      isApplied: () => true,
      onWrite: (text) => written.push(text),
    });
    assert.deepEqual(outcome, { kind: 'saved' });
    assert.equal(await readFile(configPath, 'utf8'), '{"edited":true}');
    assert.deepEqual(written, ['{"edited":true}']);
  });
  it('writes nothing when cli.json has nowhere for the change', async () => {
    const configPath = await scratchConfig('{}');
    const outcome = await saveAndVerify({
      store: storeAt(configPath),
      edit: () => undefined,
      isApplied: () => true,
      onWrite: () => {},
    });
    assert.deepEqual(outcome, { kind: 'unlisted' });
    assert.equal(await readFile(configPath, 'utf8'), '{}');
  });
  it('reports a failure instead of throwing when cli.json cannot be written', async () => {
    const blocker = await scratchConfig('{}');
    const outcome = await saveAndVerify({
      store: storeAt(path.join(blocker, 'cli.json')),
      edit: () => '{}',
      isApplied: () => true,
      onWrite: () => {},
    });
    assert.equal(outcome.kind, 'failed');
  });
});
