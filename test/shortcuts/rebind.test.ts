import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SHOW_COMMAND_ID } from '#src/plugin-ids.ts';
import {
  bindingText,
  canRebind,
  findClashOwner,
  isApplied,
  planRebind,
  resolutionsFor,
  withPlannedKeys,
} from '#src/shortcuts/rebind.ts';
import { entry } from '#test/fixtures.ts';

const LEADER = 'ctrl+x';
const switchModel = entry({ title: 'Switch model', keys: ['ctrl+x m'] });
const palette = entry({ title: 'Show command palette', keys: ['ctrl+p'] });
const history = entry({ title: 'Previous prompt history', keys: ['↑'], commandID: undefined });
const todoSettings = entry({ title: 'Todo sidebar settings', commandID: 'example.todo.settings' });

const builtInKey = (commandID: string) => (commandID.startsWith('example.') ? undefined : commandID);

const titlesWithSequences = (changes: ReturnType<typeof planRebind>) =>
  changes.map((change) => [change.entry.title, change.sequences]);

describe('planRebind', () => {
  it('replaces every key when asked to replace', () => {
    assert.deepEqual(
      titlesWithSequences(planRebind({ target: switchModel, sequence: 'f6', mode: 'replace' }, LEADER)),
      [['Switch model', ['f6']]],
    );
  });
  it('keeps the old keys when asked to add', () => {
    assert.deepEqual(titlesWithSequences(planRebind({ target: switchModel, sequence: 'f6', mode: 'add' }, LEADER)), [
      ['Switch model', ['ctrl+x m', 'f6']],
    ]);
  });
  it("hands the target's old keys to the other command on a swap", () => {
    const changes = planRebind(
      { target: switchModel, sequence: 'ctrl+p', mode: 'replace', clash: { owner: palette, resolution: 'swap' } },
      LEADER,
    );
    assert.deepEqual(titlesWithSequences(changes), [
      ['Switch model', ['ctrl+p']],
      ['Show command palette', ['ctrl+x m']],
    ]);
  });
  it('leaves the other command without a key on a move', () => {
    const changes = planRebind(
      { target: switchModel, sequence: 'ctrl+p', mode: 'replace', clash: { owner: palette, resolution: 'move' } },
      LEADER,
    );
    assert.deepEqual(titlesWithSequences(changes), [
      ['Switch model', ['ctrl+p']],
      ['Show command palette', []],
    ]);
  });
  it('changes only the target when the other command is kept', () => {
    const changes = planRebind(
      { target: switchModel, sequence: 'up', mode: 'replace', clash: { owner: history, resolution: 'keep' } },
      LEADER,
    );
    assert.deepEqual(titlesWithSequences(changes), [['Switch model', ['up']]]);
  });
});

describe('findClashOwner', () => {
  it('finds a clash written in display spelling', () => {
    assert.equal(findClashOwner([switchModel, palette, history], switchModel, 'up', LEADER), history);
  });
  it('does not count the target clashing with itself', () => {
    assert.equal(findClashOwner([switchModel], switchModel, 'ctrl+x m', LEADER), undefined);
  });
});

describe('resolutionsFor', () => {
  it('offers swap only when replacing, since adding frees no key to hand over', () => {
    assert.deepEqual(resolutionsFor(palette, 'replace', builtInKey), ['swap', 'move']);
    assert.deepEqual(resolutionsFor(palette, 'add', builtInKey), ['move']);
  });
  it('can only bind anyway when the other command cannot be rebound', () => {
    assert.deepEqual(resolutionsFor(history, 'replace', builtInKey), ['keep']);
    assert.deepEqual(resolutionsFor(todoSettings, 'replace', builtInKey), ['keep']);
  });
});

describe('canRebind', () => {
  it('allows a command the config file has a key for', () => {
    assert.equal(canRebind(entry({ title: 'Switch model', commandID: 'model.list' }), builtInKey), true);
  });
  it('refuses a command the config file has no key for', () => {
    assert.equal(canRebind(todoSettings, builtInKey), false);
  });
  it("allows this plugin's own command, which saves to its options", () => {
    assert.equal(
      canRebind(entry({ title: 'Show keyboard shortcuts', commandID: SHOW_COMMAND_ID }), () => undefined),
      true,
    );
  });
  it('refuses a command with no ID', () => {
    assert.equal(canRebind(history, builtInKey), false);
  });
});

describe('bindingText', () => {
  it('writes leader sequences with the leader token and an empty list as none', () => {
    assert.equal(bindingText(['ctrl+x m', 'f6'], LEADER), '<leader>m,f6');
    assert.equal(bindingText([], LEADER), 'none');
  });
});

describe('isApplied', () => {
  it('compares what OpenCode now shows against what was written, in any order', () => {
    const change = { entry: switchModel, sequences: ['ctrl+x m', 'alt+down'] };
    assert.equal(isApplied(change, ['alt+↓', 'ctrl+x m'], LEADER), true);
    assert.equal(isApplied(change, ['ctrl+x m'], LEADER), false);
  });
});

describe('withPlannedKeys', () => {
  it('writes the planned keys onto the rows they belong to and leaves the rest alone', () => {
    const [updatedModel, updatedPalette] = withPlannedKeys(
      [switchModel, palette],
      [{ entry: switchModel, sequences: ['f8'] }],
    );
    assert.deepEqual(updatedModel?.keys, ['f8']);
    assert.deepEqual(updatedPalette?.keys, palette.keys);
  });
});
