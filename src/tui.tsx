import type { TuiPluginModule } from '@opencode-ai/plugin/tui';
import type { Plugin } from '@opencode/plugin/tui';

import { setupForOpencodeV1 } from '#src/host/v1/setup.tsx';
import { setupForOpencodeV2 } from '#src/host/v2/setup.tsx';
import { PACKAGE_NAME } from '#src/plugin-ids.ts';

export default {
  id: PACKAGE_NAME,
  setup: setupForOpencodeV2,
  tui: setupForOpencodeV1,
} satisfies Plugin.Definition & TuiPluginModule;
