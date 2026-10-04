import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canonicalSequence,
  configSequence,
  displayedKeys,
  isModifierOnly,
  pressedChord,
  splitBinding,
  type PressedKey,
} from '#src/shortcuts/keys.ts';

const pressed = (name: string, modifiers: Partial<Omit<PressedKey, 'name'>> = {}): PressedKey => ({
  name,
  ctrl: false,
  meta: false,
  option: false,
  shift: false,
  super: false,
  hyper: false,
  ...modifiers,
});

describe('pressedChord', () => {
  it('writes modifiers in a fixed order whatever the terminal reported', () => {
    assert.equal(pressedChord(pressed('g', { shift: true, ctrl: true, meta: true })), 'ctrl+alt+shift+g');
  });
  it('treats option and meta as alt', () => {
    assert.equal(pressedChord(pressed('down', { option: true })), 'alt+down');
  });
  it('spells the space bar the way cli.json does', () => {
    assert.equal(pressedChord(pressed(' ', { ctrl: true })), 'ctrl+space');
  });
});

describe('isModifierOnly', () => {
  it('ignores a bare modifier press so recording waits for the real key', () => {
    assert.equal(isModifierOnly(pressed('leftshift', { shift: true })), true);
    assert.equal(isModifierOnly(pressed('s', { shift: true })), false);
  });
});

describe('canonicalSequence', () => {
  it("matches OpenCode's display spelling against cli.json's", () => {
    assert.equal(canonicalSequence('shift+alt+↓', 'ctrl+x'), canonicalSequence('alt+shift+down', 'ctrl+x'));
    assert.equal(canonicalSequence('ctrl+x enter', 'ctrl+x'), canonicalSequence('<leader>return', 'ctrl+x'));
  });
  it('expands the leader to whichever key is configured', () => {
    assert.equal(canonicalSequence('<leader>m', 'ctrl+space'), 'ctrl+space m');
  });
  it('keeps a plus key intact', () => {
    assert.equal(canonicalSequence('ctrl++', 'ctrl+x'), 'ctrl++');
  });
});

describe('configSequence', () => {
  it('writes a leader sequence with the leader token so it follows a changed leader', () => {
    assert.equal(configSequence('ctrl+x m', 'ctrl+x'), '<leader>m');
  });
  it('leaves a single chord alone', () => {
    assert.equal(configSequence('ctrl+g', 'ctrl+x'), 'ctrl+g');
  });
});

describe('displayedKeys', () => {
  it('hides the legacy ctrl+_ beside ctrl+/', () => {
    assert.deepEqual(displayedKeys(['ctrl+/', 'ctrl+_', 'ctrl+x s']), ['ctrl+/', 'ctrl+x s']);
  });
  it('shows ctrl+_ when it is the only way in', () => {
    assert.deepEqual(displayedKeys(['ctrl+_']), ['ctrl+_']);
  });
  it('capitalises function keys and leaves other keys alone', () => {
    assert.deepEqual(displayedKeys(['f6', 'shift+f12', 'ctrl+x f2', 'ctrl+f', 'f']), [
      'F6',
      'shift+F12',
      'ctrl+x F2',
      'ctrl+f',
      'f',
    ]);
  });
});

describe('splitBinding', () => {
  it('drops blanks and none', () => {
    assert.deepEqual(splitBinding('ctrl+c, ,none,<leader>q'), ['ctrl+c', '<leader>q']);
  });
});
