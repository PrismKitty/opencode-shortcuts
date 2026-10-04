import type { Plugin } from '@opencode/plugin/tui';

import type { Host, HostCommand, Palette } from '#src/host/types.ts';

const themePalette = (theme: Plugin.Context['theme']): Palette => ({
  text: theme.text.base,
  mutedText: theme.text.muted,
  accent: theme.hue.accent[300],
  lightAccent: theme.hue.accent[200],
  border: theme.border.base,
  background: theme.background.base,
  selectedBackground: theme.background.raised.high,
  fieldBackground: theme.background.formfield.focused,
  fieldText: theme.text.formfield.focused,
  success: theme.text.feedback.success.base,
  error: theme.text.feedback.error.base,
  info: theme.text.feedback.info.base,
  warning: theme.text.feedback.warning.base,
});

export const v2Host = (context: Plugin.Context): Host => ({
  renderer: context.renderer,
  palette: () => themePalette(context.theme),
  commands: () =>
    context.keymap.commands().map((command): HostCommand => {
      const { id, title, group } = command;
      if (id === undefined) {
        const binding = typeof command.bind === 'string' ? command.bind : undefined;
        return { id, title, group, binding, run: () => void command.run() };
      }
      return { id, title, group, run: () => context.keymap.dispatch(id) };
    }),
  shortcuts: (commandID) => context.keymap.shortcuts(commandID),
  useLayer: (build) => context.keymap.layer(build),
  pushMode: (mode) => context.keymap.mode.push(mode),
  dialogTopPadding: () => 0,
  showDialog: (render, onClose) =>
    context.ui.dialog.show(() => {
      context.ui.dialog.set({ size: 'xlarge', centered: true });
      return render();
    }, onClose),
  clearDialog: () => context.ui.dialog.clear(),
});
