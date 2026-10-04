import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  columnCountFor,
  columnHeight,
  entryBeside,
  groupEntries,
  scrollHeightFor,
  splitIntoColumns,
} from '#src/ui/columns/layout.ts';
import { entry } from '#test/fixtures.ts';

const entriesInGroup = (name: string, size: number) =>
  Array.from({ length: size }, (_, index) => entry({ title: `${name} ${index}`, group: name }));

describe('groupEntries', () => {
  it('sorts groups alphabetically with Other last', () => {
    const groups = groupEntries([
      ...entriesInGroup('Other', 1),
      ...entriesInGroup('Session', 1),
      ...entriesInGroup('Agent', 1),
    ]);
    assert.deepEqual(
      groups.map((group) => group.name),
      ['Agent', 'Session', 'Other'],
    );
  });
  it('lists bound commands before unbound ones within a group', () => {
    const [group] = groupEntries([entry({ title: 'Unbound' }), entry({ title: 'Bound', keys: ['ctrl+g'] })]);
    assert.deepEqual(
      group?.entries.map((row) => row.title),
      ['Bound', 'Unbound'],
    );
  });
});

describe('splitIntoColumns', () => {
  it('keeps reading order and evens out the column heights', () => {
    const groups = groupEntries([
      ...entriesInGroup('A', 10),
      ...entriesInGroup('B', 4),
      ...entriesInGroup('C', 4),
      ...entriesInGroup('D', 2),
    ]);
    const columns = splitIntoColumns(groups, 2);
    assert.deepEqual(
      columns.map((column) => column.map((group) => group.name)),
      [['A'], ['B', 'C', 'D']],
    );
    assert.deepEqual(columns.map(columnHeight), [13, 19]);
  });
  it('stays in one column when that is all there is room for', () => {
    assert.equal(splitIntoColumns(groupEntries([...entriesInGroup('A', 3), ...entriesInGroup('B', 3)]), 1).length, 1);
  });
  it('never leaves a column empty when groups run out', () => {
    assert.deepEqual(
      splitIntoColumns(groupEntries(entriesInGroup('A', 3)), 2).map((column) => column.length),
      [1],
    );
  });
});

describe('entryBeside', () => {
  const columns = splitIntoColumns(
    groupEntries([
      ...entriesInGroup('A', 10),
      ...entriesInGroup('B', 4),
      ...entriesInGroup('C', 4),
      ...entriesInGroup('D', 2),
    ]),
    2,
  );
  const besideTitle = (title: string, direction: -1 | 1): string | undefined => {
    const selected = columns
      .flat()
      .flatMap((group) => group.entries)
      .find((row) => row.title === title);
    return selected === undefined ? undefined : entryBeside(columns, selected.rowID, direction)?.title;
  };
  it('moves right to the entry on the same screen row', () => {
    assert.equal(besideTitle('A 2', 1), 'B 2');
  });
  it('lands on the closest entry when the row beside is a heading or gap', () => {
    assert.equal(besideTitle('A 4', 1), 'B 3');
    assert.equal(besideTitle('A 6', 1), 'C 0');
  });
  it('moves left back across', () => {
    assert.equal(besideTitle('C 0', -1), 'A 7');
  });
  it('stays put at the outer columns', () => {
    assert.equal(besideTitle('A 0', -1), undefined);
    assert.equal(besideTitle('B 0', 1), undefined);
  });
});

describe('columnCountFor', () => {
  it('fits two columns in a wide terminal and one in a narrow one', () => {
    assert.equal(columnCountFor(200), 2);
    assert.equal(columnCountFor(100), 1);
  });
});

describe('scrollHeightFor', () => {
  it('shrinks to leave room for the dialog chrome but never below a usable height', () => {
    assert.equal(scrollHeightFor(80, 50), 35);
    assert.equal(scrollHeightFor(10, 50), 10);
    assert.equal(scrollHeightFor(80, 12), 5);
  });
});
