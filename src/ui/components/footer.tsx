import { For, Show } from 'solid-js';

import type { Palette } from '#src/host/types.ts';
import { CUSTOMISED_MARK, RESTART_MARK, RULE } from '#src/ui/components/column-view.tsx';
import type { FooterLine } from '#src/ui/rebinding/steps.ts';

interface FooterProps {
  palette: Palette;
  line: FooterLine;
  showsCustomisedLegend: boolean;
  showsRestartLegend: boolean;
}

export const Footer = (props: FooterProps) => {
  const promptColor = () => (props.line.isAwaitingChoice ? props.palette.accent : props.palette.text);

  return (
    <box flexDirection="column">
      <text height={1} wrapMode="char" fg={props.palette.border}>
        {RULE}
      </text>
      <box flexDirection="row" justifyContent="space-between" gap={2}>
        <text flexShrink={1} wrapMode="word">
          <Show when={props.line.prompt}>
            {(prompt: () => string) => (
              <span style={{ fg: promptColor() }}>
                <Show when={props.line.isAwaitingChoice} fallback={prompt()}>
                  <b>{prompt()}</b>
                </Show>
                {'  '}
              </span>
            )}
          </Show>
          <For each={props.line.hints}>
            {(hint) => (
              <>
                <Show
                  when={props.line.isAwaitingChoice}
                  fallback={
                    <span style={{ fg: props.palette.accent }}>
                      <b>{hint.key}</b>
                    </span>
                  }
                >
                  <span style={{ fg: props.palette.background, bg: props.palette.accent }}>
                    <b>{` ${hint.key} `}</b>
                  </span>
                </Show>
                <span style={{ fg: props.palette.text }}>{` ${hint.action}   `}</span>
              </>
            )}
          </For>
        </text>
        <box flexDirection="row" flexShrink={0} gap={3}>
          <Show when={props.showsCustomisedLegend}>
            <text>
              <span style={{ fg: props.palette.info }}>{CUSTOMISED_MARK}</span>
              <span style={{ fg: props.palette.mutedText }}> customised</span>
            </text>
          </Show>
          <Show when={props.showsRestartLegend}>
            <text>
              <span style={{ fg: props.palette.warning }}>{RESTART_MARK}</span>
              <span style={{ fg: props.palette.mutedText }}> after restart</span>
            </text>
          </Show>
        </box>
      </box>
    </box>
  );
};
