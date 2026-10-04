import type { KeyEvent } from '@opentui/core';

export type PressedKey = Pick<KeyEvent, 'name' | 'ctrl' | 'meta' | 'option' | 'shift' | 'super' | 'hyper'>;

export const LEADER_TOKEN = '<leader>';
export const DEFAULT_LEADER = 'ctrl+x';

const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'super', 'hyper'] as const;

const MODIFIER_ALIASES: Record<string, string> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  meta: 'alt',
  option: 'alt',
  shift: 'shift',
  super: 'super',
  hyper: 'hyper',
};

/**
 * OpenCode displays some keys differently from how cli.json spells them, so both sides are folded
 * onto the config spelling before comparing
 */
const NAME_ALIASES: Record<string, string> = {
  ' ': 'space',
  enter: 'return',
  esc: 'escape',
  '↑': 'up',
  '↓': 'down',
  '←': 'left',
  '→': 'right',
  pgup: 'pageup',
  pgdn: 'pagedown',
  del: 'delete',
};

const MODIFIER_KEY_NAMES = new Set([
  ...Object.keys(MODIFIER_ALIASES),
  'leftshift',
  'rightshift',
  'leftctrl',
  'rightctrl',
  'leftalt',
  'rightalt',
  'leftsuper',
  'rightsuper',
  'lefthyper',
  'righthyper',
  'leftmeta',
  'rightmeta',
  'capslock',
  'numlock',
]);

const canonicalName = (name: string): string => {
  const lowered = name.toLowerCase();
  return NAME_ALIASES[lowered] ?? lowered;
};

const joinChord = (modifiers: ReadonlySet<string>, name: string): string =>
  [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), canonicalName(name)].join('+');

export const isModifierOnly = (key: PressedKey): boolean => MODIFIER_KEY_NAMES.has(key.name.toLowerCase());

export const pressedChord = (key: PressedKey): string => {
  const modifiers = new Set<string>();
  if (key.ctrl) {
    modifiers.add('ctrl');
  }
  if (key.meta || key.option) {
    modifiers.add('alt');
  }
  if (key.shift) {
    modifiers.add('shift');
  }
  if (key.super) {
    modifiers.add('super');
  }
  if (key.hyper) {
    modifiers.add('hyper');
  }
  return joinChord(modifiers, key.name);
};

const canonicalChord = (chord: string): string => {
  if (chord === '+' || chord.endsWith('++')) {
    const modifiers = chord.slice(0, -1).split('+').filter(Boolean);
    return joinChord(new Set(modifiers.map((modifier) => MODIFIER_ALIASES[modifier.toLowerCase()] ?? modifier)), '+');
  }
  const tokens = chord.split('+');
  const name = tokens.pop() ?? '';
  return joinChord(new Set(tokens.map((token) => MODIFIER_ALIASES[token.toLowerCase()] ?? token.toLowerCase())), name);
};

/**
 * One key sequence, either as OpenCode displays it ("ctrl+x m", "shift+alt+↓") or as cli.json
 * spells it ("<leader>m", "alt+shift+down"), in a single spelling that compares equal across both
 */
export const canonicalSequence = (sequence: string, leader: string): string => {
  const expanded = sequence.startsWith(LEADER_TOKEN) ? `${leader} ${sequence.slice(LEADER_TOKEN.length)}` : sequence;
  return expanded.trim().split(/\s+/).map(canonicalChord).join(' ');
};

export const configSequence = (canonical: string, leader: string): string => {
  const leaderChord = canonicalChord(leader);
  const chords = canonical.split(' ');
  if (chords.length === 2 && chords[0] === leaderChord) {
    return `${LEADER_TOKEN}${chords[1]}`;
  }
  return canonical;
};

export const displayedSequence = (sequence: string): string =>
  sequence.replace(/(^|[+ ])f(\d{1,2})(?=$|[+ ])/g, '$1F$2');

/**
 * Terminals without the kitty keyboard protocol send ctrl+/ as the ctrl+_ byte, so ctrl+_ beside
 * ctrl+/ is the same key twice
 */
export const displayedKeys = (keys: readonly string[]): string[] => {
  const canonicalKeys = keys.map((key) => canonicalSequence(key, DEFAULT_LEADER));
  const shownKeys = canonicalKeys.includes('ctrl+/')
    ? keys.filter((_key, index) => canonicalKeys[index] !== 'ctrl+_')
    : keys;
  return shownKeys.map(displayedSequence);
};

export const splitBinding = (binding: string): string[] =>
  binding
    .split(',')
    .map((sequence) => sequence.trim())
    .filter((sequence) => sequence !== '' && sequence !== 'none');
