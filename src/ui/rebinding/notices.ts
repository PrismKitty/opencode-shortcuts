import path from 'node:path';

import { keyText, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import type { SaveOutcome } from '#src/storage/save.ts';

export interface Notice {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const error = (text: string): Notice => ({ tone: 'error', text });

export const cannotRebindNotice = (title: string): Notice => error(`OpenCode doesn't allow rebinding ${title}.`);

export const alreadyDefaultNotice = (title: string): Notice => error(`${title} already uses its default key.`);

export const readFailureNotice = (fileName: string, cause: unknown): Notice =>
  error(`Couldn't read ${fileName}: ${errorMessage(cause)}.`);

const FROM_NEXT_OPEN = 'from the next time its menu opens';
const AFTER_RESTART = 'once OpenCode restarts';

const whenItApplies = (entry: ShortcutEntry): string => {
  if (entry.awaitsRestart) {
    return `, ${AFTER_RESTART}`;
  }
  return entry.appliesNextOpen ? `, ${FROM_NEXT_OPEN}` : '';
};

export const reboundText = (entry: ShortcutEntry): string =>
  `${entry.title} is now ${keyText(entry)}${whenItApplies(entry)}.`;

/**
 * OpenCode reports no keys for a closed menu, so the default is unknown until it opens
 */
export const resetText = (entry: ShortcutEntry): string => {
  if (entry.appliesNextOpen && !entry.awaitsRestart) {
    return `${entry.title} is back to its default, ${FROM_NEXT_OPEN}.`;
  }
  return `${entry.title} is back to its default, ${keyText(entry) || 'unbound'}${whenItApplies(entry)}.`;
};

export const saveNotice = (outcome: SaveOutcome, fileName: string, title: string, successText: string): Notice => {
  switch (outcome.kind) {
    case 'saved':
      return { tone: 'success', text: successText };
    case 'reverted':
      return error(`Couldn't change the key for ${title}. ${fileName} is unchanged.`);
    case 'unlisted':
      return error(
        `This plugin isn't in ${fileName}, so its key can't be saved there. Set its keybind option instead.`,
      );
    case 'failed':
      return error(`Couldn't save ${fileName}: ${errorMessage(outcome.error)}.`);
  }
};

const displayedPath = (configPath: string, workingDirectory: string, homeDirectory: string): string => {
  const fromWorkingDirectory = path.relative(workingDirectory, configPath);
  if (!fromWorkingDirectory.startsWith('..') && !path.isAbsolute(fromWorkingDirectory)) {
    return `./${fromWorkingDirectory}`;
  }
  const fromHome = path.relative(homeDirectory, configPath);
  return fromHome.startsWith('..') || path.isAbsolute(fromHome) ? configPath : `~/${fromHome}`;
};

export const overriddenNotice = (
  precedingText: string,
  overridden: ShortcutEntry,
  overridingPath: string,
  workingDirectory: string,
  homeDirectory: string,
): Notice => {
  const displayed = displayedPath(overridingPath, workingDirectory, homeDirectory);
  const warning = `${overridden.title} stays ${keyText(overridden) || 'unbound'}, because ${displayed} sets it too and OpenCode reads that file last.`;
  return { tone: 'warning', text: [precedingText, warning].filter(Boolean).join(' ') };
};
