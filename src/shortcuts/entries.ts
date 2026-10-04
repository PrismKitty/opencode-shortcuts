import type { Host, HostCommand } from '#src/host/types.ts';
import { SHOW_COMMAND_ID } from '#src/plugin-ids.ts';
import { displayedKeys, splitBinding } from '#src/shortcuts/keys.ts';

export interface ShortcutEntry {
  rowID: string;
  title: string;
  group: string;
  keys: readonly string[];
  commandID: string | undefined;
  appliesNextOpen: boolean; // its menu is closed, so OpenCode takes a new key the next time the menu opens
  awaitsRestart: boolean; // its keys are saved, and OpenCode takes them the next time it starts
  run: () => void;
}

const ROW_ID_PREFIX = 'opencode-shortcuts-row-';
const UNGROUPED = 'Other';

const commandKeys = (shortcuts: Host['shortcuts'], command: HostCommand): string[] => {
  if (command.id === undefined) {
    return command.binding === undefined ? [] : splitBinding(command.binding);
  }
  return [...new Set(shortcuts(command.id))];
};

const deduplicationKey = (command: HostCommand): string => {
  if (command.id === undefined) {
    return `${command.group}|${command.title}|${String(command.binding)}`;
  }
  return command.id;
};

export const isBound = (entry: ShortcutEntry): boolean => entry.keys.length > 0;

export const keyText = (entry: ShortcutEntry): string => displayedKeys(entry.keys).join(', ');

export const isShowCommand = (entry: ShortcutEntry): boolean => entry.commandID === SHOW_COMMAND_ID;

export const commandNamespace = (commandID: string): string => commandID.split('.', 1)[0] ?? commandID;

export const collectEntries = (host: Pick<Host, 'commands' | 'shortcuts'>): ShortcutEntry[] => {
  const seenDeduplicationKeys = new Set<string>();
  const entries: ShortcutEntry[] = [];
  for (const command of host.commands()) {
    const key = deduplicationKey(command);
    if (command.title === undefined || seenDeduplicationKeys.has(key)) {
      continue;
    }
    seenDeduplicationKeys.add(key);
    entries.push({
      rowID: `${ROW_ID_PREFIX}${entries.length}`,
      title: command.title,
      group: command.group ?? UNGROUPED,
      keys: commandKeys(host.shortcuts, command),
      commandID: command.id,
      appliesNextOpen: false,
      awaitsRestart: false,
      run: command.run,
    });
  }
  return entries;
};

/**
 * Rows keep their rowID across a refresh, so the selection survives a rebind
 */
export const withCurrentKeys = (entries: readonly ShortcutEntry[], shortcuts: Host['shortcuts']): ShortcutEntry[] =>
  entries.map((entry) =>
    entry.commandID === undefined || entry.appliesNextOpen
      ? entry
      : { ...entry, keys: [...new Set(shortcuts(entry.commandID))] },
  );

/**
 * The cheatsheet replaces whichever menu was open, and OpenCode stops reporting keys for that menu's
 * commands until it opens again
 */
export const withClosedMenusMarked = (
  entries: readonly ShortcutEntry[],
  registered: readonly Pick<HostCommand, 'id'>[],
): ShortcutEntry[] => {
  const registeredIDs = new Set(registered.map((command) => command.id));
  return entries.map((entry) => ({
    ...entry,
    appliesNextOpen: entry.commandID !== undefined && !registeredIDs.has(entry.commandID),
  }));
};

export const withKeysAwaitingRestart = (
  entries: readonly ShortcutEntry[],
  keysByCommand: ReadonlyMap<string, readonly string[]>,
): ShortcutEntry[] =>
  entries.map((entry) => {
    const keys = entry.commandID === undefined ? undefined : keysByCommand.get(entry.commandID);
    return keys === undefined ? { ...entry, awaitsRestart: false } : { ...entry, keys, awaitsRestart: true };
  });

export const matchesQuery = (entry: ShortcutEntry, query: string): boolean => {
  const haystack = [entry.title, entry.group, entry.commandID ?? '', ...entry.keys].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => haystack.includes(token));
};

export const isUngrouped = (group: string): boolean => group === UNGROUPED;
