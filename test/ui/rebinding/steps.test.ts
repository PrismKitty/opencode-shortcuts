import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS } from '#src/settings.ts';
import { footerFor, stepAfterChord } from '#src/ui/rebinding/steps.ts';
import { entry } from '#test/fixtures.ts';

const target = entry({ title: 'Switch model', keys: ['ctrl+x m'] });
const owner = entry({ title: 'Show command palette', keys: ['ctrl+p'] });

describe('footerFor', () => {
  it('names the configured record and reset keys while browsing', () => {
    const footer = footerFor({ kind: 'browsing' }, { record: 'ctrl+e', reset: 'ctrl+backspace' }, 'ctrl+x');
    assert.deepEqual(
      footer.hints.map((hint) => `${hint.key} ${hint.action}`),
      ['↑↓←→ select', 'enter run', 'ctrl+e rebind', 'ctrl+backspace reset', 'esc close'],
    );
  });
  it('shows the leader once it has been pressed', () => {
    assert.equal(
      footerFor({ kind: 'recording', target, afterLeader: true }, DEFAULT_SETTINGS.keybinds, 'ctrl+x').prompt,
      'Press the new key for Switch model: ctrl+x …',
    );
  });
  it('names the command that already owns the key and only the resolutions on offer', () => {
    const footer = footerFor(
      { kind: 'clashing', target, sequence: 'ctrl+p', mode: 'add', owner, resolutions: ['move'] },
      DEFAULT_SETTINGS.keybinds,
      'ctrl+x',
    );
    assert.equal(footer.prompt, 'ctrl+p already runs Show command palette.');
    assert.deepEqual(
      footer.hints.map((hint) => `${hint.key} ${hint.action}`),
      ['m move', 'esc cancel'],
    );
  });
  it('marks only the steps that wait on a choice', () => {
    const steps = [
      { kind: 'browsing' },
      { kind: 'recording', target, afterLeader: false },
      { kind: 'confirming', target, sequence: 'ctrl+g' },
      { kind: 'clashing', target, sequence: 'ctrl+p', mode: 'add', owner, resolutions: ['move'] },
      { kind: 'resetting', target },
      { kind: 'saving', target },
    ] as const;
    assert.deepEqual(
      steps.map((step) => footerFor(step, DEFAULT_SETTINGS.keybinds, 'ctrl+x').isAwaitingChoice),
      [false, false, true, true, true, false],
    );
  });
  it('capitalises a function key in the confirm prompt', () => {
    assert.equal(
      footerFor({ kind: 'confirming', target, sequence: 'shift+f6' }, DEFAULT_SETTINGS.keybinds, 'ctrl+x').prompt,
      'Bind shift+F6 to Switch model?',
    );
  });
  it('says what the key is now before resetting it', () => {
    assert.equal(
      footerFor({ kind: 'resetting', target }, DEFAULT_SETTINGS.keybinds, 'ctrl+x').prompt,
      "Reset Switch model to OpenCode's default? It's ctrl+x m now.",
    );
  });
});

describe('stepAfterChord', () => {
  const recording = { kind: 'recording', target, afterLeader: false } as const;
  it('waits for a second key after the leader', () => {
    assert.deepEqual(stepAfterChord(recording, 'ctrl+x', 'ctrl+x'), { ...recording, afterLeader: true });
  });
  it('asks to confirm the leader sequence once the second key arrives', () => {
    assert.deepEqual(stepAfterChord({ ...recording, afterLeader: true }, 'ctrl+x', 'ctrl+x'), {
      kind: 'confirming',
      target,
      sequence: 'ctrl+x ctrl+x',
    });
  });
  it('asks to confirm a single chord', () => {
    assert.deepEqual(stepAfterChord(recording, 'ctrl+g', 'ctrl+x'), {
      kind: 'confirming',
      target,
      sequence: 'ctrl+g',
    });
  });
  it('goes back to browsing on escape', () => {
    assert.deepEqual(stepAfterChord(recording, 'escape', 'ctrl+x'), { kind: 'browsing' });
  });
});
