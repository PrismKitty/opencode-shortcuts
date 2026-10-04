import assert from 'node:assert/strict';
import { watch } from 'node:fs';
import { mkdir, mkdtemp, readFile, readlink, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  configuredLeader,
  hasKeybindOverride,
  readConfig,
  withKeybind,
  writeConfig,
} from '#src/storage/config-file.ts';

const CONFIG = `{
  "$schema": "https://opencode.ai/v2/cli.json",
  // kept through every edit
  "keybinds": {
    "leader": "ctrl+space",
  },
}
`;

const EMPTY = '{ "$schema": "empty" }';

/**
 * OpenCode notices config edits through a watch on its config directory, so this watches the same way
 */
const namesChangedDuring = async (directory: string, action: () => Promise<void>): Promise<string[]> => {
  const changedNames: string[] = [];
  const watcher = watch(directory, (_event, name) => changedNames.push(String(name)));
  await action();
  await new Promise((resolve) => setTimeout(resolve, 200));
  watcher.close();
  return changedNames;
};

describe('withKeybind', () => {
  it('adds an override and keeps comments and trailing commas readable', () => {
    const text = withKeybind(CONFIG, 'model.list', '<leader>k');
    assert.equal(hasKeybindOverride(text, 'model.list'), true);
    assert.match(text, /\/\/ kept through every edit/);
  });
  it('removes an override when given no binding', () => {
    const text = withKeybind(withKeybind(CONFIG, 'model.list', 'f6'), 'model.list', undefined);
    assert.equal(hasKeybindOverride(text, 'model.list'), false);
  });
});

describe('configuredLeader', () => {
  it("reads a configured leader and falls back to OpenCode's default", () => {
    assert.equal(configuredLeader(CONFIG), 'ctrl+space');
    assert.equal(configuredLeader('{}'), 'ctrl+x');
  });
});

describe('writeConfig', () => {
  it('writes through a symlinked config file instead of replacing the link', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    const target = path.join(directory, 'real.json');
    const link = path.join(directory, 'cli.json');
    await writeFile(target, '{}');
    await symlink(target, link);
    await writeConfig(link, '{ "keybinds": {} }');
    assert.equal(await readlink(link), target);
    assert.equal(await readFile(target, 'utf8'), '{ "keybinds": {} }');
  });
  it('tells a watcher on the link directory about a write to a target elsewhere', async () => {
    const configDirectory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    const targetDirectory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    const target = path.join(targetDirectory, 'cli.json');
    const link = path.join(configDirectory, 'cli.json');
    await writeFile(target, '{}');
    await symlink(target, link);
    const changedNames = await namesChangedDuring(configDirectory, () => writeConfig(link, '{ "keybinds": {} }'));
    assert.ok(changedNames.includes('cli.json'));
  });
});

describe('readConfig', () => {
  it('starts from the empty text when the file does not exist yet', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    assert.equal(await readConfig(path.join(directory, 'cli.json'), EMPTY), EMPTY);
  });
  it('refuses to treat a file it cannot read as empty', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    await mkdir(path.join(directory, 'cli.json'));
    await assert.rejects(readConfig(path.join(directory, 'cli.json'), EMPTY), { code: 'EISDIR' });
  });
});
