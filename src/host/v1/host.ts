import type { TuiPluginApi } from '@opencode-ai/plugin/tui';
import { createEffect, onCleanup } from 'solid-js';

import type { Host, HostLayer, HostLayerCommand, NamedCommand, Palette } from '#src/host/types.ts';

export const MINIMUM_V1_VERSION = '1.15.6';

const themePalette = (theme: TuiPluginApi['theme']['current']): Palette => ({
  text: theme.text,
  mutedText: theme.textMuted,
  accent: theme.primary,
  lightAccent: theme.accent,
  border: theme.border,
  background: theme.backgroundPanel,
  selectedBackground: theme.backgroundElement,
  fieldBackground: theme.backgroundElement,
  fieldText: theme.text,
  success: theme.success,
  error: theme.error,
  info: theme.info,
  warning: theme.warning,
});

const textOrUndefined = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const modeRestriction = (mode: HostLayer['mode']) => (mode === 'global' ? {} : { mode });

const paletteListing = (command: HostLayerCommand) => (command.palette ? { namespace: 'palette' } : {});

const slashListing = ({ slash }: HostLayerCommand) =>
  slash === undefined ? {} : { slashName: slash.name, slashAliases: slash.aliases ?? [] };

const namedCommandsIn = (layer: HostLayer) =>
  layer.commands.flatMap((command) => {
    if (command.id === undefined) {
      return [];
    }
    return [
      {
        name: command.id,
        title: command.title,
        category: command.group,
        ...paletteListing(command),
        ...slashListing(command),
        run: () => command.run(),
      },
    ];
  });

const keyBindingsIn = (layer: HostLayer) =>
  layer.commands.flatMap((command) => {
    if (command.bind === false) {
      return [];
    }
    const commandOrHandler = command.id ?? (() => command.run());
    return [{ key: command.bind, cmd: commandOrHandler, desc: command.title, group: command.group }];
  });

const toV1Layer = (layer: HostLayer) => ({
  ...modeRestriction(layer.mode),
  enabled: layer.enabled ?? true,
  priority: layer.priority ?? 0,
  commands: namedCommandsIn(layer),
  bindings: keyBindingsIn(layer),
});

const reachableCommands = (api: TuiPluginApi): NamedCommand[] =>
  api.keymap.getCommands({ visibility: 'reachable' }).map((command) => ({
    id: command.name,
    title: textOrUndefined(command.title),
    group: textOrUndefined(command.category),
    run: () => void api.keymap.dispatchCommand(command.name),
  }));

const formattedShortcuts = (api: TuiPluginApi, commandID: string): string[] => {
  const bindings = api.keymap.getCommandBindings({ visibility: 'registered', commands: [commandID] }).get(commandID);
  return (bindings ?? []).map((binding) => api.keys.formatSequence(binding.sequence)).filter(Boolean);
};

export const hasKeymapAndModes = (api: Partial<TuiPluginApi>): boolean =>
  typeof api.keymap?.getCommands === 'function' && typeof api.mode?.push === 'function';

export const v1Host = (api: TuiPluginApi): Host => ({
  renderer: api.renderer,
  palette: () => themePalette(api.theme.current),
  commands: () => reachableCommands(api),
  shortcuts: (commandID) => formattedShortcuts(api, commandID),
  useLayer: (build) => createEffect(() => onCleanup(api.keymap.registerLayer(toV1Layer(build())))),
  pushMode: (mode) => api.mode.push(mode),
  dialogTopPadding: (terminalHeight) => Math.floor(terminalHeight / 4),
  showDialog: (render, onClose) => {
    api.ui.dialog.replace(render, onClose);
    api.ui.dialog.setSize('xlarge');
  },
  clearDialog: () => api.ui.dialog.clear(),
});
