import type { HostLayer, HostLayerCommand } from '#src/host/types.ts';
import type { RebindKeys } from '#src/settings.ts';
import type { ClashResolution, RebindMode } from '#src/shortcuts/rebind.ts';
import { RESOLUTION_CONTROLS, type Step } from '#src/ui/rebinding/steps.ts';

export interface OverlayActions {
  moveSelection: (distance: number) => void;
  moveAcross: (direction: -1 | 1) => void;
  runSelected: () => void;
  startRecording: () => void;
  startReset: () => void;
  rebind: (mode: RebindMode, resolution?: ClashResolution) => void;
  reset: () => void;
  cancel: () => void;
}

const PAGE_ROWS = 10;
const GROUP = 'Shortcuts';

const command = (bind: string, title: string, run: () => void): HostLayerCommand => ({
  bind,
  title,
  group: GROUP,
  run,
});

const rebindCommands = (keys: RebindKeys, actions: OverlayActions): HostLayerCommand[] => [
  command(keys.record, 'Rebind shortcut', actions.startRecording),
  command(keys.reset, 'Reset shortcut', actions.startReset),
];

const commandsFor = (step: Step, rebindKeys: RebindKeys, actions: OverlayActions): HostLayerCommand[] => {
  const cancel = command('escape', 'Cancel', actions.cancel);
  switch (step.kind) {
    case 'browsing':
      return [
        command('up,ctrl+p', 'Previous shortcut', () => actions.moveSelection(-1)),
        command('down,ctrl+n', 'Next shortcut', () => actions.moveSelection(1)),
        command('left', 'Shortcut to the left', () => actions.moveAcross(-1)),
        command('right', 'Shortcut to the right', () => actions.moveAcross(1)),
        command('pageup', 'Page up', () => actions.moveSelection(-PAGE_ROWS)),
        command('pagedown', 'Page down', () => actions.moveSelection(PAGE_ROWS)),
        command('return', 'Run shortcut', actions.runSelected),
        ...rebindCommands(rebindKeys, actions),
      ];
    case 'confirming':
      return [
        command('return', 'Replace keys', () => actions.rebind('replace')),
        command('shift+return', 'Add key', () => actions.rebind('add')),
        cancel,
      ];
    case 'clashing':
      return [
        ...step.resolutions.map((resolution) =>
          command(RESOLUTION_CONTROLS[resolution].bind, `Resolve clash: ${resolution}`, () =>
            actions.rebind(step.mode, resolution),
          ),
        ),
        cancel,
      ];
    case 'resetting':
      return [command('return', 'Reset to default', actions.reset), cancel];
    case 'recording':
    case 'saving':
      return [];
  }
};

export const overlayLayer = (step: Step, rebindKeys: RebindKeys, actions: OverlayActions): HostLayer => ({
  mode: 'modal',
  priority: 1,
  commands: commandsFor(step, rebindKeys, actions),
});
