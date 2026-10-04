import { createEffect, createMemo, createSignal, on, type Accessor } from 'solid-js';

import type { ShortcutEntry } from '#src/shortcuts/entries.ts';
import { entryBeside, type Column } from '#src/ui/columns/layout.ts';

export const useSelection = (columns: Accessor<readonly Column[]>, query: Accessor<string>) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const orderedEntries = createMemo(() =>
    columns()
      .flat()
      .flatMap((group) => group.entries),
  );
  const selected = () => orderedEntries()[selectedIndex()];
  createEffect(on(query, () => setSelectedIndex(0), { defer: true }));
  const move = (distance: number) => {
    const lastIndex = orderedEntries().length - 1;
    setSelectedIndex((index) => Math.max(0, Math.min(lastIndex, index + distance)));
  };
  const select = (entry: ShortcutEntry) => setSelectedIndex(orderedEntries().indexOf(entry));
  const moveAcross = (direction: -1 | 1) => {
    const current = selected();
    const beside = current === undefined ? undefined : entryBeside(columns(), current.rowID, direction);
    if (beside !== undefined) {
      select(beside);
    }
  };
  return { orderedEntries, selected, move, moveAcross, select };
};
