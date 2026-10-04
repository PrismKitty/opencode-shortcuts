import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import type { KeybindStore } from '#src/host/types.ts';
import { V1_KEYBINDS } from '#src/host/v1/generated/v1-keybinds.ts';
import { keybindsIn } from '#src/settings.ts';
import { editedConfig, opencodeConfigDirectory, parsedConfig } from '#src/storage/config-file.ts';
import type { PluginMatcher } from '#src/storage/plugin-matcher.ts';

type PluginSpecification = string | [unknown, unknown];

interface TuiConfig {
  plugin: PluginSpecification[];
}

const EMPTY_CONFIG = '{\n  "$schema": "https://opencode.ai/tui.json"\n}\n';

const specificationName = (specification: PluginSpecification): unknown =>
  typeof specification === 'string' ? specification : specification[0];

const thisPluginIndex = (text: string, isThisPlugin: PluginMatcher): number =>
  (parsedConfig<TuiConfig>(text).plugin ?? []).findIndex((specification) => {
    const name = specificationName(specification);
    return typeof name === 'string' && isThisPlugin(name);
  });

const pluginOptions = (specification: PluginSpecification | undefined): unknown =>
  Array.isArray(specification) ? specification[1] : undefined;

const pluginShowKeybind = (text: string, isThisPlugin: PluginMatcher): unknown => {
  const index = thisPluginIndex(text, isThisPlugin);
  return keybindsIn(pluginOptions(parsedConfig<TuiConfig>(text).plugin?.[index])).show;
};

const withPluginShowKeybind = (
  text: string,
  isThisPlugin: PluginMatcher,
  binding: string | undefined,
): string | undefined => {
  const index = thisPluginIndex(text, isThisPlugin);
  const specification = parsedConfig<TuiConfig>(text).plugin?.[index];
  if (specification === undefined) {
    return undefined;
  }
  if (Array.isArray(specification)) {
    return editedConfig(text, ['plugin', index, 1, 'keybinds', 'show'], binding);
  }
  if (binding === undefined) {
    return text;
  }
  return editedConfig(text, ['plugin', index], [specification, { keybinds: { show: binding } }]);
};

/**
 * v1 reads tui.jsonc after tui.json, so a key saved in tui.jsonc wins when both exist
 */
const globalTuiConfigPath = (): string => {
  const jsoncPath = path.join(opencodeConfigDirectory(), 'tui.jsonc');
  return existsSync(jsoncPath) ? jsoncPath : path.join(opencodeConfigDirectory(), 'tui.json');
};

const tuiConfigFilesIn = (directory: string): string[] => [
  path.join(directory, 'tui.json'),
  path.join(directory, 'tui.jsonc'),
];

const isSwitchedOn = (value: string | undefined): boolean => value?.toLowerCase() === 'true' || value === '1';

const directoriesFromRoot = (directory: string): string[] => {
  const parent = path.dirname(directory);
  return parent === directory ? [directory] : [...directoriesFromRoot(parent), directory];
};

/**
 * The files v1 merges over the global tui.json, in the order it reads them, so the last one setting a key wins.
 * v1 visits .opencode folders nearest first, the reverse of plain tui.json files
 */
export const laterTuiConfigPaths = (
  workingDirectory: string,
  homeDirectory: string,
  environment: Readonly<Record<string, string | undefined>>,
): string[] => {
  const projectDirectories = isSwitchedOn(environment.OPENCODE_DISABLE_PROJECT_CONFIG)
    ? []
    : directoriesFromRoot(path.resolve(workingDirectory));
  const dotOpencodeDirectories = [
    ...projectDirectories.toReversed().map((directory) => path.join(directory, '.opencode')),
    path.join(homeDirectory, '.opencode'),
    ...(environment.OPENCODE_CONFIG_DIR === undefined ? [] : [environment.OPENCODE_CONFIG_DIR]),
  ];
  const globalPaths = tuiConfigFilesIn(opencodeConfigDirectory());
  return [
    ...(environment.OPENCODE_TUI_CONFIG === undefined ? [] : [environment.OPENCODE_TUI_CONFIG]),
    ...projectDirectories.flatMap(tuiConfigFilesIn),
    ...[...new Set(dotOpencodeDirectories)].flatMap(tuiConfigFilesIn),
  ].filter((configPath) => !globalPaths.includes(configPath));
};

export const tuiJsonStore = (isThisPlugin: PluginMatcher): KeybindStore => ({
  path: globalTuiConfigPath(),
  emptyText: EMPTY_CONFIG,
  appliesAfterRestart: true,
  configKey: (commandID) => V1_KEYBINDS.get(commandID)?.configKey,
  defaultBinding: (commandID) => V1_KEYBINDS.get(commandID)?.defaultBinding,
  pluginShowKeybind: (text) => pluginShowKeybind(text, isThisPlugin),
  withPluginShowKeybind: (text, binding) => withPluginShowKeybind(text, isThisPlugin, binding),
  laterConfigPaths: () => laterTuiConfigPaths(process.cwd(), homedir(), process.env),
});
