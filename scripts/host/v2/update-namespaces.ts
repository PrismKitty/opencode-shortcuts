#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { commandNamespace } from '#src/shortcuts/entries.ts';

interface KeybindsSchema {
  properties?: Record<string, unknown>;
  anyOf?: KeybindsSchema[];
}

interface CliSchema {
  properties: { keybinds: KeybindsSchema };
}

const SCHEMA_URL = 'https://opencode.ai/v2/cli.json';
const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'src',
  'host',
  'v2',
  'generated',
  'built-in-namespaces.ts',
);

const fetchSchema = async (): Promise<CliSchema> => {
  const response = await fetch(SCHEMA_URL);
  if (!response.ok) {
    throw new Error(`${SCHEMA_URL} answered ${response.status}`);
  }
  return (await response.json()) as CliSchema;
};

const keybindIDsInSchema = (schema: CliSchema): string[] => {
  const keybinds = schema.properties.keybinds;
  const listing = [keybinds, ...(keybinds.anyOf ?? [])].find((option) => option.properties !== undefined);
  if (listing?.properties === undefined) {
    throw new Error(`${SCHEMA_URL} no longer lists the keybind IDs`);
  }
  return Object.keys(listing.properties).filter((id) => id !== 'leader');
};

const moduleText = (namespaces: readonly string[]): string =>
  [
    '/**',
    ` * Namespaces of the commands whose keybinds OpenCode reads from cli.json, taken from ${SCHEMA_URL}.`,
    ' * Regenerate with pnpm update:namespaces rather than editing by hand',
    ' */',
    'export const BUILT_IN_NAMESPACES: ReadonlySet<string> = new Set([',
    ...namespaces.map((namespace) => `  '${namespace}',`),
    ']);',
    '',
  ].join('\n');

const namespaces = [...new Set(keybindIDsInSchema(await fetchSchema()).map(commandNamespace))].sort();
await writeFile(OUTPUT_PATH, moduleText(namespaces));
console.log(`Wrote ${namespaces.length} namespaces to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
