import { Show } from 'solid-js';

import type { Palette } from '#src/host/types.ts';
import type { Notice } from '#src/ui/rebinding/notices.ts';

interface NoticeLineProps {
  palette: Palette;
  notice: Notice | undefined;
}

const TONE_MARKS: Record<Notice['tone'], string> = { success: '✓', warning: '!', error: '✗' };

export const NoticeLine = (props: NoticeLineProps) => (
  <Show when={props.notice}>
    {(notice: () => Notice) => (
      <text fg={props.palette[notice().tone]}>{`${TONE_MARKS[notice().tone]} ${notice().text}`}</text>
    )}
  </Show>
);
