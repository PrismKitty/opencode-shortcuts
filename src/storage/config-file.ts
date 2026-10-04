import { applyEdits, modify, parse, type FormattingOptions, type JSONPath } from 'jsonc-parser';
import { lstat, lutimes, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { KeybindStore } from '#src/host/types.ts';
import { showKeybindSetting } from '#src/settings.ts';
import { DEFAULT_LEADER } from '#src/shortcuts/keys.ts';

interface ParsedKeybinds {
  keybinds?: Record<string, unknown>;
}

export const parsedConfig = <Shape>(text: string): Partial<Shape> => {
  const value: unknown = parse(text, [], { allowTrailingComma: true });
  return typeof value === 'object' && value !== null ? value : {};
};

const detectedFormatting = (text: string): FormattingOptions => {
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
  return {
    insertSpaces: !indent.includes('\t'),
    tabSize: indent.includes('\t') ? 1 : indent.length,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  };
};

export const editedConfig = (text: string, jsonPath: JSONPath, value: unknown): string =>
  applyEdits(text, modify(text, jsonPath, value, { formattingOptions: detectedFormatting(text) }));

export const opencodeConfigDirectory = (): string =>
  path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'opencode');

const isMissingFile = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const readConfig = async (configPath: string, emptyText: string): Promise<string> => {
  try {
    return await readFile(configPath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return emptyText;
    }
    throw error;
  }
};

/**
 * OpenCode watches its config directory, which never hears about a write that lands in a symlink's
 * target elsewhere. Touching the link itself raises a change there
 */
const touchIfSymlink = async (configPath: string): Promise<void> => {
  if (!(await lstat(configPath)).isSymbolicLink()) {
    return;
  }
  const now = new Date();
  await lutimes(configPath, now, now);
};

/**
 * writeFile follows a symlinked config file rather than replacing the link, which dotfile setups rely on
 */
export const writeConfig = async (configPath: string, text: string): Promise<void> => {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, text);
  await touchIfSymlink(configPath);
};

export const configuredLeader = (text: string): string => {
  const leader = parsedConfig<ParsedKeybinds>(text).keybinds?.leader;
  return typeof leader === 'string' ? leader : DEFAULT_LEADER;
};

export const configuredKeybind = (store: KeybindStore, text: string, fallback: string | false): string | false => {
  const override = store.pluginShowKeybind(text);
  return override === undefined ? fallback : showKeybindSetting(override);
};

export const hasKeybindOverride = (text: string, configKey: string): boolean =>
  parsedConfig<ParsedKeybinds>(text).keybinds?.[configKey] !== undefined;

export const withKeybind = (text: string, configKey: string, binding: string | undefined): string =>
  editedConfig(text, ['keybinds', configKey], binding);
