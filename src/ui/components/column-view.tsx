import { For, Show } from 'solid-js';

import type { Palette } from '#src/host/types.ts';
import { isBound, type ShortcutEntry } from '#src/shortcuts/entries.ts';
import { displayedKeys } from '#src/shortcuts/keys.ts';
import type { Column } from '#src/ui/columns/layout.ts';

interface ColumnProps {
  palette: Palette;
  column: Column;
  selectedRowID: string | undefined;
  recordingRowID: string | undefined;
  isCustomised: (entry: ShortcutEntry) => boolean;
  select: (entry: ShortcutEntry) => void;
  run: (entry: ShortcutEntry) => void;
}

interface RowProps {
  palette: Palette;
  entry: ShortcutEntry;
  isSelected: boolean;
  isRecording: boolean;
  isCustomised: boolean;
  select: (entry: ShortcutEntry) => void;
  run: (entry: ShortcutEntry) => void;
}

export const CUSTOMISED_MARK = '•';
export const RESTART_MARK = '↻';
const RECORDING_PROMPT = 'press a key…';
/**
 * Longer than any column: the text wraps at the column's width, and its height of one row hides the rest
 */
export const RULE = '─'.repeat(160);

const Row = (props: RowProps) => {
  const focused = () => props.isSelected;

  const titleColor = () => {
    if (focused()) {
      return props.palette.text;
    }
    return isBound(props.entry) ? props.palette.text : props.palette.mutedText;
  };

  return (
    <box
      id={props.entry.rowID}
      flexDirection="row"
      gap={1}
      backgroundColor={focused() ? props.palette.selectedBackground : undefined}
      onMouseOver={() => props.select(props.entry)}
      onMouseUp={() => props.run(props.entry)}
    >
      <text flexShrink={0} fg={props.palette.accent}>
        {focused() ? '▌' : ' '}
      </text>
      <text flexGrow={1} wrapMode="word" fg={titleColor()}>
        <Show when={focused()} fallback={props.entry.title}>
          <b>{props.entry.title}</b>
        </Show>
        <Show when={props.isCustomised}>
          <span style={{ fg: props.palette.info }}>{` ${CUSTOMISED_MARK}`}</span>
        </Show>
        <Show when={props.entry.awaitsRestart}>
          <span style={{ fg: props.palette.warning }}>{` ${RESTART_MARK}`}</span>
        </Show>
      </text>
      <text flexShrink={0} paddingRight={1}>
        <Show
          when={!props.isRecording}
          fallback={<span style={{ fg: props.palette.warning }}>{RECORDING_PROMPT}</span>}
        >
          <For each={displayedKeys(props.entry.keys)}>
            {(key, index) => (
              <>
                <Show when={index() > 0}>
                  <span style={{ fg: props.palette.mutedText }}> · </span>
                </Show>
                <span style={{ fg: props.palette.lightAccent }}>{key}</span>
              </>
            )}
          </For>
        </Show>
      </text>
    </box>
  );
};

export const ColumnView = (props: ColumnProps) => (
  <box flexDirection="column" flexGrow={1} flexBasis={0}>
    <For each={props.column}>
      {(group) => (
        <box flexDirection="column" paddingBottom={1}>
          <box flexDirection="row" gap={1} height={2}>
            <text flexShrink={0} fg={props.palette.accent}>
              <b>{` ${group.name}`}</b>
            </text>
            <text flexGrow={1} flexShrink={1} flexBasis={0} height={1} wrapMode="char" fg={props.palette.border}>
              {RULE}
            </text>
          </box>
          <For each={group.entries}>
            {(entry) => (
              <Row
                palette={props.palette}
                entry={entry}
                isSelected={props.selectedRowID === entry.rowID}
                isRecording={props.recordingRowID === entry.rowID}
                isCustomised={props.isCustomised(entry)}
                select={props.select}
                run={props.run}
              />
            )}
          </For>
        </box>
      )}
    </For>
  </box>
);
