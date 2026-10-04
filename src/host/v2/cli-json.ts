import path from 'node:path';

import type { KeybindStore } from '#src/host/types.ts';
import { BUILT_IN_NAMESPACES } from '#src/host/v2/generated/built-in-namespaces.ts';
import { keybindsIn } from '#src/settings.ts';
import { commandNamespace } from '#src/shortcuts/entries.ts';
import { editedConfig, opencodeConfigDirectory, parsedConfig } from '#src/storage/config-file.ts';
import type { PluginMatcher } from '#src/storage/plugin-matcher.ts';

type PluginSpecification = string | { package?: unknown; options?: unknown };

interface CliConfig {
  plugins: PluginSpecification[];
}

const EMPTY_CONFIG = '{\n  "$schema": "https://opencode.ai/v2/cli.json"\n}\n';

const specificationName = (specification: PluginSpecification): string | undefined => {
  if (typeof specification === 'string') {
    return specification;
  }
  return typeof specification.package === 'string' ? specification.package : undefined;
};

const thisPluginIndex = (text: string, isThisPlugin: PluginMatcher): number =>
  (parsedConfig<CliConfig>(text).plugins ?? []).findIndex((specification) => {
    const name = specificationName(specification);
    return name !== undefined && isThisPlugin(name);
  });

const pluginOptions = (specification: PluginSpecification | undefined): unknown =>
  typeof specification === 'object' ? specification.options : undefined;

const pluginShowKeybind = (text: string, isThisPlugin: PluginMatcher): unknown => {
  const index = thisPluginIndex(text, isThisPlugin);
  return keybindsIn(pluginOptions(parsedConfig<CliConfig>(text).plugins?.[index])).show;
};

const withPluginShowKeybind = (
  text: string,
  isThisPlugin: PluginMatcher,
  binding: string | undefined,
): string | undefined => {
  const index = thisPluginIndex(text, isThisPlugin);
  const specification = parsedConfig<CliConfig>(text).plugins?.[index];
  if (specification === undefined) {
    return undefined;
  }
  if (typeof specification !== 'string') {
    return editedConfig(text, ['plugins', index, 'options', 'keybinds', 'show'], binding);
  }
  if (binding === undefined) {
    return text;
  }
  return editedConfig(text, ['plugins', index], { package: specification, options: { keybinds: { show: binding } } });
};

/**
 * OpenCode ignores cli.json keybinds for commands that other plugins register
 */
const builtInConfigKey = (commandID: string): string | undefined =>
  BUILT_IN_NAMESPACES.has(commandNamespace(commandID)) ? commandID : undefined;

export const cliJsonStore = (isThisPlugin: PluginMatcher): KeybindStore => ({
  path: path.join(opencodeConfigDirectory(), 'cli.json'),
  emptyText: EMPTY_CONFIG,
  appliesAfterRestart: false,
  configKey: builtInConfigKey,
  defaultBinding: () => undefined,
  pluginShowKeybind: (text) => pluginShowKeybind(text, isThisPlugin),
  withPluginShowKeybind: (text, binding) => withPluginShowKeybind(text, isThisPlugin, binding),
  laterConfigPaths: () => [],
});
