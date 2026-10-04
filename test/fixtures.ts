import type { ShortcutEntry } from '#src/shortcuts/entries.ts';

let rowCount = 0;

export const entry = (fields: Partial<ShortcutEntry> & Pick<ShortcutEntry, 'title'>): ShortcutEntry => ({
  rowID: `row-${rowCount++}`,
  group: 'Session',
  keys: [],
  appliesNextOpen: false,
  awaitsRestart: false,
  commandID: `session.${fields.title.toLowerCase().replaceAll(' ', '_')}`,
  run: () => {},
  ...fields,
});
