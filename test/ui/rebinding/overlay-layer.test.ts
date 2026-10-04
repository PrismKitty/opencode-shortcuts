import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS } from '#src/settings.ts';
import { overlayLayer, type OverlayActions } from '#src/ui/rebinding/overlay-layer.ts';
import { entry } from '#test/fixtures.ts';

const target = entry({ title: 'Switch model', keys: ['ctrl+x m'] });
const owner = entry({ title: 'Show command palette', keys: ['ctrl+p'] });

const recordedActions = (calls: string[]): OverlayActions => ({
  moveSelection: (distance) => calls.push(`move ${distance}`),
  moveAcross: (direction) => calls.push(`across ${direction}`),
  runSelected: () => calls.push('run'),
  startRecording: () => calls.push('record'),
  startReset: () => calls.push('reset'),
  rebind: (mode, resolution) => calls.push(`rebind ${mode} ${resolution ?? ''}`.trim()),
  reset: () => calls.push('confirm reset'),
  cancel: () => calls.push('cancel'),
});

const bindsInLayer = (layer: ReturnType<typeof overlayLayer>): (string | false | undefined)[] =>
  (layer.commands ?? []).map((command) => command.bind);

describe('overlayLayer', () => {
  it('binds the configured record and reset keys while browsing', () => {
    const layer = overlayLayer({ kind: 'browsing' }, { record: 'ctrl+e', reset: 'ctrl+k' }, recordedActions([]));
    assert.deepEqual(bindsInLayer(layer), [
      'up,ctrl+p',
      'down,ctrl+n',
      'left',
      'right',
      'pageup',
      'pagedown',
      'return',
      'ctrl+e',
      'ctrl+k',
    ]);
  });
  it('offers only the clash resolutions on the step, each passing the rebind mode through', () => {
    const calls: string[] = [];
    const step = { kind: 'clashing', target, sequence: 'ctrl+p', mode: 'add', owner, resolutions: ['move'] } as const;
    const layer = overlayLayer(step, DEFAULT_SETTINGS.keybinds, recordedActions(calls));
    assert.deepEqual(bindsInLayer(layer), ['m', 'escape']);
    void layer.commands?.[0]?.run();
    assert.deepEqual(calls, ['rebind add move']);
  });
  it('binds nothing while recording, since the key capture hears every key', () => {
    const layer = overlayLayer(
      { kind: 'recording', target, afterLeader: false },
      DEFAULT_SETTINGS.keybinds,
      recordedActions([]),
    );
    assert.deepEqual(bindsInLayer(layer), []);
    assert.equal(layer.mode, 'modal');
  });
});
