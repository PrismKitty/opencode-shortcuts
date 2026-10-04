export interface RebindKeys {
  record: string;
  reset: string;
}

interface ShortcutsKeybinds extends RebindKeys {
  show: string | false;
}

export interface ShortcutsSettings {
  keybinds: ShortcutsKeybinds;
}

/**
 * Terminals without the kitty keyboard protocol send ctrl+/ as the ctrl+_ byte
 */
const DEFAULT_SHOW_KEYBIND = 'ctrl+/,ctrl+_';

export const DEFAULT_SETTINGS: ShortcutsSettings = {
  keybinds: {
    show: DEFAULT_SHOW_KEYBIND,
    record: 'ctrl+r',
    reset: 'ctrl+d',
  },
};

const keySetting = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value : fallback;

export const showKeybindSetting = (value: unknown): string | false => {
  if (value === false || value === 'none') {
    return false;
  }
  return keySetting(value, DEFAULT_SHOW_KEYBIND);
};

export const keybindsIn = (options: unknown): Readonly<Record<string, unknown>> => {
  if (typeof options !== 'object' || options === null || !('keybinds' in options)) {
    return {};
  }
  const keybinds = options.keybinds;
  return typeof keybinds === 'object' && keybinds !== null ? (keybinds as Record<string, unknown>) : {};
};

/**
 * Reads the options object from this plugin's cli.json entry, falling back to defaults for anything
 * missing or malformed
 */
export const readSettings = (options: Readonly<Record<string, unknown>>): ShortcutsSettings => {
  const keybinds = keybindsIn(options);
  return {
    keybinds: {
      show: showKeybindSetting(keybinds.show),
      record: keySetting(keybinds.record, DEFAULT_SETTINGS.keybinds.record),
      reset: keySetting(keybinds.reset, DEFAULT_SETTINGS.keybinds.reset),
    },
  };
};
