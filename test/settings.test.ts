import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, readSettings } from '#src/settings.ts';

describe('readSettings', () => {
  it('uses the defaults when nothing is configured', () => {
    assert.deepEqual(readSettings({}), DEFAULT_SETTINGS);
  });
  it('takes configured keybinds and lets the opening key be switched off', () => {
    assert.deepEqual(readSettings({ keybinds: { show: false, record: 'ctrl+e', reset: 'ctrl+backspace' } }), {
      keybinds: { show: false, record: 'ctrl+e', reset: 'ctrl+backspace' },
    });
    assert.equal(readSettings({ keybinds: { show: 'none' } }).keybinds.show, false);
  });
  it('ignores values of the wrong type rather than failing to load', () => {
    assert.deepEqual(readSettings({ keybinds: { show: 7, record: '', reset: null } }), DEFAULT_SETTINGS);
    assert.deepEqual(readSettings({ keybinds: 'ctrl+/' }), DEFAULT_SETTINGS);
  });
});
