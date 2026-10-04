import type { KeybindStore } from '#src/host/types.ts';
import { isShowCommand, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import type { KeyChange } from '#src/shortcuts/rebind.ts';
import { hasKeybindOverride, readConfig } from '#src/storage/config-file.ts';

const EMPTY_CONFIG = '{}';

/**
 * A file OpenCode cannot read is one it skips, so it overrides nothing
 */
const readableConfig = (configPath: string): Promise<string> =>
  readConfig(configPath, EMPTY_CONFIG).catch(() => EMPTY_CONFIG);

const configKey = (store: KeybindStore, entry: ShortcutEntry): string | undefined =>
  entry.commandID === undefined || isShowCommand(entry) ? undefined : store.configKey(entry.commandID);

/**
 * For each change, the last file OpenCode reads after the store's own that sets the same key, which is the one
 * that wins. Undefined where no later file sets it
 */
export const overridingConfigPaths = async (
  store: KeybindStore,
  changes: readonly KeyChange[],
): Promise<(string | undefined)[]> => {
  const laterPaths = store.laterConfigPaths();
  const texts = await Promise.all(laterPaths.map(readableConfig));
  return changes.map(({ entry }) => {
    const key = configKey(store, entry);
    if (key === undefined) {
      return undefined;
    }
    return laterPaths.findLast((_configPath, index) => hasKeybindOverride(texts[index] ?? EMPTY_CONFIG, key));
  });
};
