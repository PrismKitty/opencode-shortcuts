import type { ScrollBoxRenderable } from '@opentui/core';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';

import type { Host, KeybindStore } from '#src/host/types.ts';
import type { ShortcutsSettings } from '#src/settings.ts';
import { isBound, matchesQuery, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import {
  columnCountFor,
  columnHeight,
  groupEntries,
  scrollHeightFor,
  splitIntoColumns,
} from '#src/ui/columns/layout.ts';
import { useSelection } from '#src/ui/columns/use-selection.ts';
import { useTerminalSize } from '#src/ui/columns/use-terminal-size.ts';
import { ColumnView } from '#src/ui/components/column-view.tsx';
import { Footer } from '#src/ui/components/footer.tsx';
import { Header } from '#src/ui/components/header.tsx';
import { NoticeLine } from '#src/ui/components/notice-line.tsx';
import { SearchField } from '#src/ui/components/search-field.tsx';
import { overlayLayer } from '#src/ui/rebinding/overlay-layer.ts';
import { footerFor } from '#src/ui/rebinding/steps.ts';
import { useRebinding } from '#src/ui/rebinding/use-rebinding.ts';

interface CheatsheetProps {
  host: Host;
  settings: ShortcutsSettings;
  entries: readonly ShortcutEntry[];
  store: KeybindStore;
  keysAwaitingRestart: () => ReadonlyMap<string, readonly string[]>;
  setKeysAwaitingRestart: (keysByCommand: ReadonlyMap<string, readonly string[]>) => void;
  onConfigWritten: (text: string) => void;
  setRecording: (isRecording: boolean) => void;
  close: () => void;
}

export const Cheatsheet = (props: CheatsheetProps) => {
  const { host } = props;
  const palette = host.palette;
  const terminalSize = useTerminalSize(host.renderer);
  const rebinding = useRebinding(props);
  const [query, setQuery] = createSignal('');
  const columnCount = () => columnCountFor(terminalSize().width);
  const fullHeight = createMemo(() =>
    Math.max(...splitIntoColumns(groupEntries(props.entries), columnCount()).map(columnHeight)),
  );
  const columns = createMemo(() =>
    splitIntoColumns(groupEntries(rebinding.entries().filter((entry) => matchesQuery(entry, query()))), columnCount()),
  );
  const selection = useSelection(columns, query);
  const step = rebinding.step;
  const recordingRowID = () => {
    const current = step();
    return current.kind === 'recording' ? current.target.rowID : undefined;
  };
  let scrollbox: ScrollBoxRenderable | undefined;

  createEffect(() => {
    const entry = selection.selected();
    if (entry !== undefined) {
      scrollbox?.scrollChildIntoView(entry.rowID);
    }
  });

  const run = (entry: ShortcutEntry | undefined) => {
    if (entry === undefined || step().kind !== 'browsing') {
      return;
    }
    props.close();
    setTimeout(entry.run, 1);
  };

  const onSelected = (action: (entry: ShortcutEntry) => void) => () => {
    const entry = selection.selected();
    if (entry !== undefined) {
      action(entry);
    }
  };

  host.useLayer(() =>
    overlayLayer(step(), props.settings.keybinds, {
      moveSelection: selection.move,
      moveAcross: selection.moveAcross,
      runSelected: onSelected(run),
      startRecording: onSelected(rebinding.startRecording),
      startReset: onSelected(rebinding.startReset),
      rebind: rebinding.rebind,
      reset: rebinding.reset,
      cancel: rebinding.cancel,
    }),
  );

  return (
    <box flexDirection="column" gap={1} paddingLeft={3} paddingRight={3} paddingBottom={1}>
      <Header
        palette={palette()}
        boundCount={rebinding.entries().filter(isBound).length}
        totalCount={rebinding.entries().length}
      />
      <SearchField palette={palette()} isFocused={step().kind === 'browsing'} onInput={setQuery} />
      <scrollbox
        ref={(element: ScrollBoxRenderable) => (scrollbox = element)}
        height={scrollHeightFor(fullHeight(), terminalSize().height - host.dialogTopPadding(terminalSize().height))}
        scrollbarOptions={{ visible: false }}
      >
        <Show
          when={selection.orderedEntries().length > 0}
          fallback={<text fg={palette().mutedText}>{`Nothing matches "${query()}"`}</text>}
        >
          <box flexDirection="row" gap={2}>
            <For each={columns()}>
              {(column) => (
                <ColumnView
                  palette={palette()}
                  column={column}
                  selectedRowID={selection.selected()?.rowID}
                  recordingRowID={recordingRowID()}
                  isCustomised={rebinding.isCustomised}
                  select={selection.select}
                  run={run}
                />
              )}
            </For>
          </box>
        </Show>
      </scrollbox>
      <box flexDirection="column">
        <NoticeLine palette={palette()} notice={rebinding.notice()} />
        <Footer
          palette={palette()}
          line={footerFor(step(), props.settings.keybinds, rebinding.leader())}
          showsCustomisedLegend={step().kind === 'browsing' && rebinding.entries().some(rebinding.isCustomised)}
          showsRestartLegend={step().kind === 'browsing' && rebinding.entries().some((entry) => entry.awaitsRestart)}
        />
      </box>
    </box>
  );
};
