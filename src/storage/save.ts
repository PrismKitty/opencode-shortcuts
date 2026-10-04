import type { KeybindStore } from '#src/host/types.ts';
import { isShowCommand, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import { bindingText, type KeyChange } from '#src/shortcuts/rebind.ts';
import { hasKeybindOverride, readConfig, withKeybind, writeConfig } from '#src/storage/config-file.ts';

export type SaveOutcome =
  { kind: 'saved' } | { kind: 'reverted' } | { kind: 'unlisted' } | { kind: 'failed'; error: unknown };

interface SaveRequest {
  store: KeybindStore;
  edit: (text: string) => string | undefined; // undefined when the config file has nowhere to put the change
  isApplied: () => boolean;
  onWrite: (text: string) => void;
}

const POLL_INTERVAL = 100;
const APPLY_TIMEOUT = 6000;

const withBinding = (
  store: KeybindStore,
  text: string,
  entry: ShortcutEntry,
  binding: string | undefined,
): string | undefined => {
  if (entry.commandID === undefined) {
    return undefined;
  }
  if (isShowCommand(entry)) {
    return store.withPluginShowKeybind(text, binding);
  }
  const configKey = store.configKey(entry.commandID);
  return configKey === undefined ? undefined : withKeybind(text, configKey, binding);
};

/**
 * Undefined when some change has nowhere in the config file to live
 */
export const textWithChanges = (
  store: KeybindStore,
  text: string,
  changes: readonly KeyChange[],
  leader: string,
): string | undefined =>
  changes.reduce<string | undefined>(
    (current, change) =>
      current === undefined
        ? undefined
        : withBinding(store, current, change.entry, bindingText(change.sequences, leader)),
    text,
  );

export const textWithReset = (store: KeybindStore, text: string, entry: ShortcutEntry): string | undefined =>
  withBinding(store, text, entry, undefined);

export const isCustomised = (store: KeybindStore, text: string, entry: ShortcutEntry): boolean => {
  if (entry.commandID === undefined) {
    return false;
  }
  if (isShowCommand(entry)) {
    return store.pluginShowKeybind(text) !== undefined;
  }
  const configKey = store.configKey(entry.commandID);
  return configKey !== undefined && hasKeybindOverride(text, configKey);
};

const pause = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitUntil = async (isDone: () => boolean, timeout: number): Promise<boolean> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (isDone()) {
      return true;
    }
    await pause(POLL_INTERVAL);
  }
  return isDone();
};

const writeAndFollow = async (request: SaveRequest, text: string): Promise<void> => {
  await writeConfig(request.store.path, text);
  request.onWrite(text);
};

const attemptSave = async (request: SaveRequest): Promise<SaveOutcome> => {
  const original = await readConfig(request.store.path, request.store.emptyText);
  const updated = request.edit(original);
  if (updated === undefined) {
    return { kind: 'unlisted' };
  }
  await writeAndFollow(request, updated);
  if (await waitUntil(request.isApplied, APPLY_TIMEOUT)) {
    return { kind: 'saved' };
  }
  await writeAndFollow(request, original);
  return { kind: 'reverted' };
};

/**
 * Puts the config file back as it was when OpenCode doesn't apply the edit in time
 */
export const saveAndVerify = async (request: SaveRequest): Promise<SaveOutcome> => {
  try {
    return await attemptSave(request);
  } catch (error) {
    return { kind: 'failed', error };
  }
};
