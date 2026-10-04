import type { KeyEvent } from '@opentui/core';

import type { Host } from '#src/host/types.ts';
import { RECORDING_MODE } from '#src/plugin-ids.ts';
import { isModifierOnly, pressedChord } from '#src/shortcuts/keys.ts';

export const captureChords = (host: Host, onChord: (chord: string) => void): (() => void) => {
  const listener = (event: KeyEvent) => {
    if (event.eventType === 'release' || isModifierOnly(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onChord(pressedChord(event));
  };
  const leaveMode = host.pushMode(RECORDING_MODE);
  // Ahead of OpenCode's own listener, which would otherwise swallow the leader key
  host.renderer.keyInput.prependListener('keypress', listener);
  return () => {
    host.renderer.keyInput.off('keypress', listener);
    leaveMode();
  };
};
