import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { pluginMatcher } from '#src/storage/plugin-matcher.ts';

describe('pluginMatcher', () => {
  it('recognises the package by name, by pinned version and by a path to any of its directories', async () => {
    const configDirectory = await mkdtemp(path.join(tmpdir(), 'opencode-shortcuts-'));
    const packageRoot = path.join(configDirectory, 'plugins', 'shortcuts');
    const sourceDirectory = path.join(packageRoot, 'src');
    await mkdir(sourceDirectory, { recursive: true });
    const isThisPlugin = pluginMatcher(configDirectory, [packageRoot, sourceDirectory]);
    assert.deepEqual(
      [
        'opencode-shortcuts',
        'opencode-shortcuts@0.1.0',
        './plugins/shortcuts',
        packageRoot,
        './plugins/shortcuts/src',
        'opencode-shortcuts-extra',
        './plugins/other',
      ].map(isThisPlugin),
      [true, true, true, true, true, false, false],
    );
  });
});
