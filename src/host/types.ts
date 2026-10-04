import type { CliRenderer, RGBA } from '@opentui/core';
import type { JSX } from '@opentui/solid';

export interface NamedCommand {
  id: string;
  title: string | undefined;
  group: string | undefined;
  run: () => void;
}

/**
 * Only v2 lists commands that have no ID
 */
export interface InlineCommand extends Omit<NamedCommand, 'id'> {
  id: undefined;
  binding: string | undefined;
}

export type HostCommand = NamedCommand | InlineCommand;

export interface HostLayerCommand {
  id?: string;
  title: string;
  group: string;
  bind: string | false;
  palette?: true;
  slash?: { name: string; aliases?: string[] };
  run: () => void;
}

export interface HostLayer {
  mode: 'global' | 'modal';
  enabled?: boolean;
  priority?: number;
  commands: HostLayerCommand[];
}

export interface Palette {
  text: RGBA;
  mutedText: RGBA;
  accent: RGBA;
  lightAccent: RGBA;
  border: RGBA;
  background: RGBA;
  selectedBackground: RGBA;
  fieldBackground: RGBA;
  fieldText: RGBA;
  success: RGBA;
  error: RGBA;
  info: RGBA;
  warning: RGBA;
}

export interface Host {
  renderer: CliRenderer;
  palette: () => Palette;
  commands: () => readonly HostCommand[];
  shortcuts: (commandID: string) => readonly string[];
  useLayer: (build: () => HostLayer) => void;
  pushMode: (mode: string) => () => void;
  dialogTopPadding: (terminalHeight: number) => number; // v1 only, since v1 pads every dialog down from the top
  showDialog: (render: () => JSX.Element, onClose: () => void) => void;
  clearDialog: () => void;
}

export interface KeybindStore {
  path: string;
  emptyText: string;
  appliesAfterRestart: boolean; // v1 only, since v1 reads its config file only when it starts
  configKey: (commandID: string) => string | undefined; // undefined when OpenCode reads no key for the command from this file
  defaultBinding: (commandID: string) => string | undefined; // v1 only, undefined where the plugin can ask OpenCode instead
  pluginShowKeybind: (text: string) => unknown;
  withPluginShowKeybind: (text: string, binding: string | undefined) => string | undefined; // undefined when the file does not list this plugin
  laterConfigPaths: () => readonly string[]; // v1 only, the files OpenCode reads after this one, the last winning
}
