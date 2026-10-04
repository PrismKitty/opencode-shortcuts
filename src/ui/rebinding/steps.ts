import type { RebindKeys } from '#src/settings.ts';
import { keyText, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import { displayedSequence } from '#src/shortcuts/keys.ts';
import type { ClashResolution, RebindMode } from '#src/shortcuts/rebind.ts';

export type Step =
  | { kind: 'browsing' }
  | { kind: 'recording'; target: ShortcutEntry; afterLeader: boolean }
  | { kind: 'confirming'; target: ShortcutEntry; sequence: string }
  | {
      kind: 'clashing';
      target: ShortcutEntry;
      sequence: string;
      mode: RebindMode;
      owner: ShortcutEntry;
      resolutions: readonly ClashResolution[];
    }
  | { kind: 'resetting'; target: ShortcutEntry }
  | { kind: 'saving'; target: ShortcutEntry };

type RecordingStep = Extract<Step, { kind: 'recording' }>;

interface Hint {
  key: string;
  action: string;
}

export interface FooterLine {
  prompt?: string;
  hints: readonly Hint[];
  isAwaitingChoice: boolean;
}

interface ResolutionControl {
  bind: string;
  hint: Hint;
}

export const RESOLUTION_CONTROLS: Record<ClashResolution, ResolutionControl> = {
  swap: { bind: 's', hint: { key: 's', action: 'swap' } },
  move: { bind: 'm', hint: { key: 'm', action: 'move' } },
  keep: { bind: 'return', hint: { key: 'enter', action: 'bind anyway' } },
};

const CANCEL_HINT: Hint = { key: 'esc', action: 'cancel' };

export const stepAfterChord = (step: RecordingStep, chord: string, leaderChord: string): Step => {
  if (chord === 'escape') {
    return { kind: 'browsing' };
  }
  if (!step.afterLeader && chord === leaderChord) {
    return { ...step, afterLeader: true };
  }
  return { kind: 'confirming', target: step.target, sequence: step.afterLeader ? `${leaderChord} ${chord}` : chord };
};

const currentKeys = (entry: ShortcutEntry): string => keyText(entry) || 'unbound';

const rebindHints = (keys: RebindKeys): Hint[] => [
  { key: displayedSequence(keys.record), action: 'rebind' },
  { key: displayedSequence(keys.reset), action: 'reset' },
];

export const footerFor = (step: Step, rebindKeys: RebindKeys, leader: string): FooterLine => {
  switch (step.kind) {
    case 'browsing':
      return {
        hints: [
          { key: '↑↓←→', action: 'select' },
          { key: 'enter', action: 'run' },
          ...rebindHints(rebindKeys),
          { key: 'esc', action: 'close' },
        ],
        isAwaitingChoice: false,
      };
    case 'recording':
      return {
        prompt: `Press the new key for ${step.target.title}${step.afterLeader ? `: ${displayedSequence(leader)} …` : ''}`,
        hints: [CANCEL_HINT],
        isAwaitingChoice: false,
      };
    case 'confirming':
      return {
        prompt: `Bind ${displayedSequence(step.sequence)} to ${step.target.title}?`,
        hints: [
          { key: 'enter', action: 'replace its keys' },
          { key: 'shift+enter', action: 'add alongside' },
          CANCEL_HINT,
        ],
        isAwaitingChoice: true,
      };
    case 'clashing':
      return {
        prompt: `${displayedSequence(step.sequence)} already runs ${step.owner.title}.`,
        hints: [...step.resolutions.map((resolution) => RESOLUTION_CONTROLS[resolution].hint), CANCEL_HINT],
        isAwaitingChoice: true,
      };
    case 'resetting':
      return {
        prompt: `Reset ${step.target.title} to OpenCode's default? It's ${currentKeys(step.target)} now.`,
        hints: [{ key: 'enter', action: 'reset' }, CANCEL_HINT],
        isAwaitingChoice: true,
      };
    case 'saving':
      return { prompt: `Saving ${step.target.title}…`, hints: [], isAwaitingChoice: false };
  }
};
