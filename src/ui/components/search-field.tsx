import type { InputRenderable } from '@opentui/core';
import { createEffect } from 'solid-js';

import type { Palette } from '#src/host/types.ts';

interface SearchFieldProps {
  palette: Palette;
  isFocused: boolean;
  onInput: (query: string) => void;
}

export const SearchField = (props: SearchFieldProps) => {
  let input: InputRenderable | undefined;

  createEffect(() => {
    if (props.isFocused) {
      input?.focus();
      return;
    }
    input?.blur();
  });

  return (
    <box paddingLeft={1} backgroundColor={props.isFocused ? props.palette.fieldBackground : undefined}>
      <input
        ref={(element: InputRenderable) => (input = element)}
        focused
        placeholder="Search commands, keys or groups"
        placeholderColor={props.palette.mutedText}
        focusedBackgroundColor={props.palette.fieldBackground}
        focusedTextColor={props.palette.fieldText}
        cursorColor={props.palette.fieldText}
        cursorStyle={{ style: 'line', blinking: true }}
        onInput={props.onInput}
      />
    </box>
  );
};
