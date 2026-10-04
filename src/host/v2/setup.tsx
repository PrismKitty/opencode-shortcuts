import type { Plugin } from '@opencode/plugin/tui';

import { cliJsonStore } from '#src/host/v2/cli-json.ts';
import { v2Host } from '#src/host/v2/host.ts';
import { readSettings } from '#src/settings.ts';
import { thisPluginMatcher } from '#src/storage/plugin-matcher.ts';
import { ShortcutsCommand } from '#src/ui/index.tsx';

export const setupForOpencodeV2 = (context: Plugin.Context) => {
  const host = v2Host(context);
  const settings = readSettings(context.options);
  const store = cliJsonStore(thisPluginMatcher());
  context.ui.slot({
    append: 'app',
    render: () => <ShortcutsCommand host={host} settings={settings} store={store} />,
  });
};
