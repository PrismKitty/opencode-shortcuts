#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

interface V1Keybind {
  configKey: string;
  defaultBinding: string;
}

const repository = path.resolve(import.meta.dirname, '..', '..', '..');
const OUTPUT_PATH = path.join(repository, 'src', 'host', 'v1', 'generated', 'v1-keybinds.ts');

const pluginVersion = async (): Promise<string> => {
  const packagePath = path.join(repository, 'node_modules', '@opencode-ai', 'plugin', 'package.json');
  const { version } = JSON.parse(await readFile(packagePath, 'utf8')) as { version: string };
  return version;
};

const fetchSource = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.text();
};

const objectNamed = (source: ts.SourceFile, name: string): ts.ObjectLiteralExpression => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const declaration = statement.declarationList.declarations[0];
    const initializer = declaration?.initializer;
    if (declaration?.name.getText(source) !== name || initializer === undefined) {
      continue;
    }
    const value = ts.isSatisfiesExpression(initializer) ? initializer.expression : initializer;
    if (ts.isObjectLiteralExpression(value)) {
      return value;
    }
  }
  throw new Error(`keybind.ts no longer declares ${name} as an object`);
};

const namedProperties = (object: ts.ObjectLiteralExpression): [string, ts.Expression][] =>
  object.properties.filter(ts.isPropertyAssignment).map((property) => {
    const name = property.name;
    if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) {
      throw new Error(`keybind.ts has a key that is not a plain name: ${name.getText()}`);
    }
    return [name.text, property.initializer];
  });

/**
 * keybind("ctrl+p", "...") or keybind({ key: "ctrl+v", ... }, "...")
 */
const defaultBindingIn = (configKey: string, definition: ts.Expression): string => {
  const value = ts.isCallExpression(definition) ? definition.arguments[0] : undefined;
  if (value !== undefined && ts.isStringLiteral(value)) {
    return value.text;
  }
  const key =
    value !== undefined && ts.isObjectLiteralExpression(value)
      ? namedProperties(value).find(([name]) => name === 'key')?.[1]
      : undefined;
  if (key !== undefined && ts.isStringLiteral(key)) {
    return key.text;
  }
  throw new Error(`keybind.ts gives ${configKey} a default this script cannot read`);
};

const keybindsByCommand = (source: ts.SourceFile): Map<string, V1Keybind> => {
  const commandNames = new Map(
    namedProperties(objectNamed(source, 'CommandMap')).map(([configKey, command]) => {
      if (!ts.isStringLiteral(command)) {
        throw new Error(`CommandMap maps ${configKey} to something other than a name`);
      }
      return [configKey, command.text];
    }),
  );
  const keybinds = new Map<string, V1Keybind>();
  for (const [configKey, definition] of namedProperties(objectNamed(source, 'Definitions'))) {
    if (configKey === 'leader') {
      continue;
    }
    const command = commandNames.get(configKey) ?? configKey;
    if (keybinds.has(command)) {
      throw new Error(`Two keybinds in keybind.ts name ${command}`);
    }
    keybinds.set(command, { configKey, defaultBinding: defaultBindingIn(configKey, definition) });
  }
  return keybinds;
};

const moduleText = (url: string, keybinds: Map<string, V1Keybind>): string =>
  [
    '/**',
    ` * The tui.json keybind key and default binding for each OpenCode v1 command, taken from ${url}.`,
    ' * Regenerate with pnpm update:v1-keybinds rather than editing by hand',
    ' */',
    'export const V1_KEYBINDS: ReadonlyMap<string, { configKey: string; defaultBinding: string }> = new Map([',
    ...[...keybinds].map(([command, keybind]) => `  [${JSON.stringify(command)}, ${JSON.stringify(keybind)}],`),
    ']);',
    '',
  ].join('\n');

const url = `https://raw.githubusercontent.com/anomalyco/opencode/v${await pluginVersion()}/packages/tui/src/config/keybind.ts`;
const source = ts.createSourceFile('keybind.ts', await fetchSource(url), ts.ScriptTarget.Latest, true);
const keybinds = keybindsByCommand(source);
await writeFile(OUTPUT_PATH, moduleText(url, keybinds));
console.log(`Wrote ${keybinds.size} keybinds to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
