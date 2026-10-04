import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { overriddenNotice, reboundText, resetText, saveNotice } from '#src/ui/rebinding/notices.ts';
import { entry } from '#test/fixtures.ts';

describe('reboundText', () => {
  it('names the new keys', () => {
    assert.equal(reboundText(entry({ title: 'MCP servers', keys: ['f6'] })), 'MCP servers is now F6.');
  });
  it('says when the key waits for its menu to open', () => {
    assert.equal(
      reboundText(entry({ title: 'New worktree', keys: ['ctrl+n'], appliesNextOpen: true })),
      'New worktree is now ctrl+n, from the next time its menu opens.',
    );
  });
  it('says when the key waits for OpenCode to restart', () => {
    assert.equal(
      reboundText(entry({ title: 'Switch model', keys: ['f6'], awaitsRestart: true })),
      'Switch model is now F6, once OpenCode restarts.',
    );
  });
});

describe('resetText', () => {
  it('says unbound when the default has no keys', () => {
    assert.equal(resetText(entry({ title: 'MCP servers' })), 'MCP servers is back to its default, unbound.');
  });
  it('names the default once OpenCode restarts, even for a closed menu', () => {
    assert.equal(
      resetText(entry({ title: 'Switch model', keys: ['ctrl+x m'], appliesNextOpen: true, awaitsRestart: true })),
      'Switch model is back to its default, ctrl+x m, once OpenCode restarts.',
    );
  });
});

describe('saveNotice', () => {
  it('uses the success text once the key is saved', () => {
    assert.deepEqual(saveNotice({ kind: 'saved' }, 'cli.json', 'MCP servers', 'MCP servers is now f6.'), {
      tone: 'success',
      text: 'MCP servers is now f6.',
    });
  });
  it('says cli.json is unchanged when OpenCode did not apply the key', () => {
    assert.equal(
      saveNotice({ kind: 'reverted' }, 'cli.json', 'MCP servers', '').text,
      "Couldn't change the key for MCP servers. cli.json is unchanged.",
    );
  });
  it('passes on the reason a save failed', () => {
    const cause = new Error("EACCES: permission denied, open 'cli.json'");
    assert.equal(
      saveNotice({ kind: 'failed', error: cause }, 'cli.json', 'MCP servers', '').text,
      "Couldn't save cli.json: EACCES: permission denied, open 'cli.json'.",
    );
  });
});

describe('overriddenNotice', () => {
  const switchModel = entry({ title: 'Switch model', keys: ['f9'] });
  it('says the key stays as the overriding file sets it, naming the file relative to the project', () => {
    assert.deepEqual(overriddenNotice('', switchModel, '/work/project/tui.json', '/work/project', '/home/user'), {
      tone: 'warning',
      text: 'Switch model stays F9, because ./tui.json sets it too and OpenCode reads that file last.',
    });
  });
  it('keeps the success text when another changed command is the one overridden', () => {
    assert.match(
      overriddenNotice('Palette is now F9.', switchModel, '/home/user/.opencode/tui.json', '/work', '/home/user').text,
      /^Palette is now F9\. Switch model stays F9, because ~\/\.opencode\/tui\.json sets it too/,
    );
  });
});
