import { createSignal } from 'solid-js';

import type { Host, KeybindStore } from '#src/host/types.ts';
import { SHOW_COMMAND_ID } from '#src/plugin-ids.ts';
import { type ShortcutsSettings } from '#src/settings.ts';
import { collectEntries, withKeysAwaitingRestart } from '#src/shortcuts/entries.ts';
import { configuredKeybind } from '#src/storage/config-file.ts';
import { Cheatsheet } from '#src/ui/components/cheatsheet.tsx';

interface ShortcutsCommandProps {
  host: Host;
  settings: ShortcutsSettings;
  store: KeybindStore;
}

export const ShortcutsCommand = (props: ShortcutsCommandProps) => {
  const { host, store } = props;
  const [keybind, setKeybind] = createSignal(props.settings.keybinds.show);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [keysAwaitingRestart, setKeysAwaitingRestart] = createSignal<ReadonlyMap<string, readonly string[]>>(new Map());

  const updateKeybindFromConfig = (text: string) =>
    setKeybind(configuredKeybind(store, text, props.settings.keybinds.show));

  const close = () => {
    host.clearDialog();
    setIsOpen(false);
  };

  const toggle = () => {
    if (isOpen()) {
      close();
      return;
    }
    const entries = withKeysAwaitingRestart(collectEntries(host), keysAwaitingRestart());
    setIsOpen(true);
    host.showDialog(
      () => (
        <Cheatsheet
          host={host}
          settings={props.settings}
          entries={entries}
          store={store}
          keysAwaitingRestart={keysAwaitingRestart}
          setKeysAwaitingRestart={setKeysAwaitingRestart}
          onConfigWritten={updateKeybindFromConfig}
          setRecording={setIsRecording}
          close={close}
        />
      ),
      () => setIsOpen(false),
    );
  };

  host.useLayer(() => ({
    mode: 'global',
    enabled: !isRecording(),
    commands: [
      {
        id: SHOW_COMMAND_ID,
        title: 'Show keyboard shortcuts',
        group: 'Help',
        bind: keybind(),
        palette: true,
        slash: { name: 'shortcuts', aliases: ['keys'] },
        run: toggle,
      },
    ],
  }));

  return null;
};
