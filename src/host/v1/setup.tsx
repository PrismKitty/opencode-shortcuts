import type { TuiPlugin } from '@opencode-ai/plugin/tui';
import { createRoot } from 'solid-js';

import { hasKeymapAndModes, MINIMUM_V1_VERSION, v1Host } from '#src/host/v1/host.ts';
import { tuiJsonStore } from '#src/host/v1/tui-json.ts';
import { PACKAGE_NAME } from '#src/plugin-ids.ts';
import { readSettings } from '#src/settings.ts';
import { thisPluginMatcher } from '#src/storage/plugin-matcher.ts';
import { ShortcutsCommand } from '#src/ui/index.tsx';

export const setupForOpencodeV1: TuiPlugin = async (api, options) => {
  if (!hasKeymapAndModes(api)) {
    api.ui.toast({
      variant: 'warning',
      title: PACKAGE_NAME,
      message: `Needs OpenCode ${MINIMUM_V1_VERSION} or later, so it is switched off`,
    });
    return;
  }
  const host = v1Host(api);
  const settings = readSettings(options ?? {});
  const store = tuiJsonStore(thisPluginMatcher());
  createRoot((dispose) => {
    api.lifecycle.onDispose(dispose);
    return <ShortcutsCommand host={host} settings={settings} store={store} />;
  });
};
