import { isShowCommand, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import { canonicalSequence, configSequence } from '#src/shortcuts/keys.ts';

export type RebindMode = 'replace' | 'add';

/**
 * Swap hands the target's old keys to the clashing command, move leaves it with none, and keep
 * leaves it alone when it cannot be rebound at all
 */
export type ClashResolution = 'swap' | 'move' | 'keep';

export interface Clash {
  owner: ShortcutEntry;
  resolution: ClashResolution;
}

export interface KeyChange {
  entry: ShortcutEntry;
  sequences: readonly string[];
}

export interface RebindRequest {
  target: ShortcutEntry;
  sequence: string;
  mode: RebindMode;
  clash?: Clash;
}

const unique = (sequences: readonly string[]): string[] => [...new Set(sequences)];

export const canonicalKeys = (entry: ShortcutEntry, leader: string): string[] =>
  unique(entry.keys.map((key) => canonicalSequence(key, leader)));

export const findClashOwner = (
  entries: readonly ShortcutEntry[],
  target: ShortcutEntry,
  sequence: string,
  leader: string,
): ShortcutEntry | undefined =>
  entries.find((entry) => entry.rowID !== target.rowID && canonicalKeys(entry, leader).includes(sequence));

/**
 * This plugin's own command saves to its options, and every other command needs a key in the config file
 */
export const canRebind = (entry: ShortcutEntry, configKey: (commandID: string) => string | undefined): boolean => {
  if (entry.commandID === undefined) {
    return false;
  }
  return isShowCommand(entry) || configKey(entry.commandID) !== undefined;
};

export const resolutionsFor = (
  owner: ShortcutEntry,
  mode: RebindMode,
  configKey: (commandID: string) => string | undefined,
): ClashResolution[] => {
  if (!canRebind(owner, configKey)) {
    return ['keep'];
  }
  return mode === 'replace' ? ['swap', 'move'] : ['move'];
};

const targetSequences = (request: RebindRequest, leader: string): string[] => {
  if (request.mode === 'replace') {
    return [request.sequence];
  }
  return unique([...canonicalKeys(request.target, leader), request.sequence]);
};

const ownerSequences = (request: RebindRequest, clash: Clash, leader: string): string[] => {
  const remaining = canonicalKeys(clash.owner, leader).filter((sequence) => sequence !== request.sequence);
  if (clash.resolution === 'swap') {
    return unique([...remaining, ...canonicalKeys(request.target, leader)]);
  }
  return remaining;
};

export const planRebind = (request: RebindRequest, leader: string): KeyChange[] => {
  const targetChange = { entry: request.target, sequences: targetSequences(request, leader) };
  if (request.clash === undefined || request.clash.resolution === 'keep') {
    return [targetChange];
  }
  return [targetChange, { entry: request.clash.owner, sequences: ownerSequences(request, request.clash, leader) }];
};

export const withPlannedKeys = (entries: readonly ShortcutEntry[], changes: readonly KeyChange[]): ShortcutEntry[] =>
  entries.map((entry) => {
    const change = changes.find((candidate) => candidate.entry.rowID === entry.rowID);
    return change === undefined ? entry : { ...entry, keys: [...change.sequences] };
  });

export const bindingText = (sequences: readonly string[], leader: string): string => {
  if (sequences.length === 0) {
    return 'none';
  }
  return sequences.map((sequence) => configSequence(sequence, leader)).join(',');
};

export const isApplied = (change: KeyChange, appliedKeys: readonly string[], leader: string): boolean => {
  const applied = unique(appliedKeys.map((key) => canonicalSequence(key, leader))).sort();
  const expected = [...change.sequences].sort();
  return applied.length === expected.length && applied.every((sequence, index) => sequence === expected[index]);
};
