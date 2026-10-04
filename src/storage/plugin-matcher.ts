import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGE_NAME } from '#src/plugin-ids.ts';
import { opencodeConfigDirectory } from '#src/storage/config-file.ts';

export type PluginMatcher = (specification: string) => boolean;

const realPath = (candidate: string): string => {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
};

const isPathSpecification = (specification: string): boolean =>
  specification.startsWith('file://') ||
  specification.startsWith('./') ||
  specification.startsWith('../') ||
  path.isAbsolute(specification);

/**
 * Matches the ways a config file can name this plugin: by package, by pinned version, or by a path to
 * one of its directories, which OpenCode resolves against the config directory
 */
export const pluginMatcher = (configDirectory: string, pluginDirectories: string[]): PluginMatcher => {
  const realPluginDirectories = new Set(pluginDirectories.map(realPath));
  return (specification) => {
    if (specification === PACKAGE_NAME || specification.startsWith(`${PACKAGE_NAME}@`)) {
      return true;
    }
    if (!isPathSpecification(specification)) {
      return false;
    }
    const location = specification.startsWith('file://')
      ? fileURLToPath(specification)
      : path.resolve(configDirectory, specification);
    return realPluginDirectories.has(realPath(location));
  };
};

/**
 * One level up from this file is the folder OpenCode loaded, src/ in a checkout or tui/ once built,
 * and two levels up is the package root. A config can name either
 */
export const thisPluginMatcher = (): PluginMatcher =>
  pluginMatcher(opencodeConfigDirectory(), [
    path.resolve(import.meta.dirname, '..', '..'),
    path.resolve(import.meta.dirname, '..'),
  ]);
