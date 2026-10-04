import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HostCommand, InlineCommand, NamedCommand } from '#src/host/types.ts';
import {
  collectEntries,
  withClosedMenusMarked,
  withCurrentKeys,
  withKeysAwaitingRestart,
} from '#src/shortcuts/entries.ts';
import { entry } from '#test/fixtures.ts';

const namedCommand = (fields: Partial<NamedCommand> & Pick<NamedCommand, 'id'>): NamedCommand => ({
  title: undefined,
  group: undefined,
  run: () => {},
  ...fields,
});

const inlineCommand = (fields: Partial<InlineCommand>): InlineCommand => ({
  id: undefined,
  title: undefined,
  group: undefined,
  binding: undefined,
  run: () => {},
  ...fields,
});

const fakeKeymap = (commands: HostCommand[], shortcuts: Record<string, string[]>) => ({
  commands: () => commands,
  shortcuts: (commandID: string) => shortcuts[commandID] ?? [],
});

describe('collectEntries', () => {
  it('lists each titled command once, with its keys and group', () => {
    const newSession = namedCommand({ id: 'session.new', title: 'New session', group: 'Session' });
    const keymap = fakeKeymap([newSession, newSession, namedCommand({ id: 'session.hidden' })], {
      'session.new': ['<leader>n', '<leader>n'],
    });
    const listed = collectEntries(keymap).map(({ title, group, keys, commandID }) => ({
      title,
      group,
      keys,
      commandID,
    }));
    assert.deepEqual(listed, [
      { title: 'New session', group: 'Session', keys: ['<leader>n'], commandID: 'session.new' },
    ]);
  });

  it("takes an inline command's keys from its own binding", () => {
    const keymap = fakeKeymap([inlineCommand({ title: 'Next', binding: 'down,ctrl+n' })], {});
    const [next] = collectEntries(keymap);
    assert.deepEqual(next?.keys, ['down', 'ctrl+n']);
    assert.equal(next?.group, 'Other');
  });

  it('runs the command it was made from', () => {
    let runCount = 0;
    const keymap = fakeKeymap([namedCommand({ id: 'session.new', title: 'New session', run: () => runCount++ })], {});
    collectEntries(keymap)[0]?.run();
    assert.equal(runCount, 1);
  });
});

describe('withClosedMenusMarked', () => {
  it('marks listed commands that OpenCode no longer reports', () => {
    const newWorktree = entry({ title: 'new', commandID: 'dialog.move_session.new' });
    const newSession = entry({ title: 'New session', commandID: 'session.new' });
    const history = entry({ title: 'Previous prompt history', commandID: undefined });
    const marked = withClosedMenusMarked([newWorktree, newSession, history], [{ id: 'session.new' }]);
    assert.deepEqual(
      marked.map((markedEntry) => markedEntry.appliesNextOpen),
      [true, false, false],
    );
  });
});

describe('withKeysAwaitingRestart', () => {
  it('shows the saved keys and marks the rows waiting for a restart', () => {
    const switchModel = entry({ title: 'Switch model', commandID: 'model.list', keys: ['ctrl+x m'] });
    const newSession = entry({ title: 'New session', keys: ['ctrl+x n'] });
    const marked = withKeysAwaitingRestart([switchModel, newSession], new Map([['model.list', ['f6']]]));
    assert.deepEqual(
      marked.map(({ keys, awaitsRestart }) => [keys, awaitsRestart]),
      [
        [['f6'], true],
        [['ctrl+x n'], false],
      ],
    );
  });
  it('keeps the saved keys over the ones OpenCode still reports after a refresh', () => {
    const switchModel = entry({ title: 'Switch model', commandID: 'model.list', keys: ['ctrl+x m'] });
    const refreshed = withKeysAwaitingRestart(
      withCurrentKeys([switchModel], () => ['ctrl+x m']),
      new Map([['model.list', ['f6']]]),
    );
    assert.deepEqual(refreshed[0]?.keys, ['f6']);
  });
  it('clears the mark once a command no longer waits', () => {
    const waiting = entry({ title: 'Switch model', commandID: 'model.list', keys: ['f6'], awaitsRestart: true });
    const [cleared] = withKeysAwaitingRestart(
      withCurrentKeys([waiting], () => ['f9']),
      new Map(),
    );
    assert.deepEqual([cleared?.keys, cleared?.awaitsRestart], [['f9'], false]);
  });
});
