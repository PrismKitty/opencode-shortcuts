import { isBound, isUngrouped, type ShortcutEntry } from '#src/shortcuts/entries.ts';

export interface ShortcutGroup {
  name: string;
  entries: ShortcutEntry[];
}

export type Column = readonly ShortcutGroup[];

const DIALOG_WIDTH = 116;
const DIALOG_BORDER_AND_PADDING = 8;
const MINIMUM_COLUMN_WIDTH = 48;
const COLUMN_GAP = 2;
const MINIMUM_SCROLL_HEIGHT = 5;
const ROWS_AROUND_LIST = 15;

const compareGroupNames = (left: string, right: string): number => {
  if (isUngrouped(left)) {
    return 1;
  }
  if (isUngrouped(right)) {
    return -1;
  }
  return left.localeCompare(right);
};

const boundFirst = (entries: readonly ShortcutEntry[]): ShortcutEntry[] => [
  ...entries.filter(isBound),
  ...entries.filter((entry) => !isBound(entry)),
];

export const groupEntries = (entries: readonly ShortcutEntry[]): ShortcutGroup[] => {
  const entriesByGroup = Map.groupBy(entries, (entry) => entry.group);
  return [...entriesByGroup.keys()]
    .sort(compareGroupNames)
    .map((name) => ({ name, entries: boundFirst(entriesByGroup.get(name) ?? []) }));
};

const HEADING_HEIGHT = 2;
const GROUP_PADDING_BOTTOM = 1;

const groupHeight = (group: ShortcutGroup): number => HEADING_HEIGHT + group.entries.length + GROUP_PADDING_BOTTOM;

export const columnHeight = (column: Column): number => column.reduce((sum, group) => sum + groupHeight(group), 0);

const fillColumns = (groups: readonly ShortcutGroup[], heightLimit: number): ShortcutGroup[][] => {
  const columns: ShortcutGroup[][] = [[]];
  for (const group of groups) {
    const current = columns.at(-1) ?? [];
    if (current.length > 0 && columnHeight(current) + groupHeight(group) > heightLimit) {
      columns.push([group]);
      continue;
    }
    current.push(group);
  }
  return columns;
};

/**
 * Keeps the groups in reading order and finds the shortest height they fit in, so the columns end
 * as evenly as whole groups allow
 */
export const splitIntoColumns = (groups: readonly ShortcutGroup[], columnCount: number): ShortcutGroup[][] => {
  const tallestGroup = Math.max(0, ...groups.map(groupHeight));
  const totalHeight = groups.reduce((sum, group) => sum + groupHeight(group), 0);
  for (let heightLimit = tallestGroup; heightLimit < totalHeight; heightLimit++) {
    const columns = fillColumns(groups, heightLimit);
    if (columns.length <= columnCount) {
      return columns;
    }
  }
  return [[...groups]];
};

interface PlacedEntry {
  entry: ShortcutEntry;
  columnIndex: number;
  row: number;
}

const placedEntriesInColumn = (column: Column, columnIndex: number): PlacedEntry[] => {
  let groupTop = 0;
  return column.flatMap((group) => {
    const placed = group.entries.map((entry, index) => ({
      entry,
      columnIndex,
      row: groupTop + HEADING_HEIGHT + index,
    }));
    groupTop += groupHeight(group);
    return placed;
  });
};

/**
 * The entry in the neighbouring column closest to the same screen row, the upper one on a tie
 */
export const entryBeside = (
  columns: readonly Column[],
  rowID: string,
  direction: -1 | 1,
): ShortcutEntry | undefined => {
  const placedEntries = columns.flatMap(placedEntriesInColumn);
  const selected = placedEntries.find((placed) => placed.entry.rowID === rowID);
  if (selected === undefined) {
    return undefined;
  }
  const neighbours = placedEntries.filter((placed) => placed.columnIndex === selected.columnIndex + direction);
  const distanceFromSelected = (placed: PlacedEntry): number => Math.abs(placed.row - selected.row);
  return neighbours.reduce<PlacedEntry | undefined>(
    (closest, placed) =>
      closest === undefined || distanceFromSelected(placed) < distanceFromSelected(closest) ? placed : closest,
    undefined,
  )?.entry;
};

export const columnCountFor = (terminalWidth: number): number => {
  const innerWidth = Math.min(DIALOG_WIDTH, terminalWidth - 2) - DIALOG_BORDER_AND_PADDING;
  return Math.max(1, Math.floor((innerWidth + COLUMN_GAP) / (MINIMUM_COLUMN_WIDTH + COLUMN_GAP)));
};

export const scrollHeightFor = (contentHeight: number, availableHeight: number): number =>
  Math.max(MINIMUM_SCROLL_HEIGHT, Math.min(contentHeight, availableHeight - ROWS_AROUND_LIST));
