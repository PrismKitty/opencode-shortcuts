#!/usr/bin/env node
import { transformAsync, type PluginObj } from '@babel/core';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPOSITORY_DIRECTORY = path.resolve(import.meta.dirname, '..');
const SOURCE_DIRECTORY = path.join(REPOSITORY_DIRECTORY, 'src');
/**
 * OpenCode v2 loads an installed plugin only through a root tui.* or tui/index.*, ignoring exports,
 * so the build lands where v2 looks and the entry becomes tui/index.js
 */
const OUTPUT_DIRECTORY = path.join(REPOSITORY_DIRECTORY, 'tui');
const SOURCE_ENTRY = 'tui.tsx';
const PUBLISHED_ENTRY = 'index.js';
const SOURCE_ALIAS = '#src/';
const TYPESCRIPT_EXTENSION = /\.tsx?$/;
const HOST_RUNTIME_SPECIFIERS = new Set([
  'solid-js',
  'solid-js/store',
  '@opentui/solid',
  '@opentui/core',
  '@opencode/plugin/tui',
]);

/**
 * OpenCode hands plugins its own copies of these through virtual module ids, and a plugin installed
 * from npm must import them that way or it runs a second Solid runtime (OpenCode issue #39986)
 */
const hostRuntimeModule = (specifier: string): string => `opentui:runtime-module:${encodeURIComponent(specifier)}`;

const publishedFileName = (fileName: string): string => {
  if (fileName === SOURCE_ENTRY) {
    return PUBLISHED_ENTRY;
  }
  return fileName.replace(TYPESCRIPT_EXTENSION, '.js');
};

const relativeSpecifier = (fromFileName: string, toFileName: string): string => {
  const relative = path.posix.relative(path.posix.dirname(fromFileName), publishedFileName(toFileName));
  return relative.startsWith('.') ? relative : `./${relative}`;
};

const publishedSpecifier = (specifier: string, fileName: string): string => {
  if (specifier.startsWith(SOURCE_ALIAS)) {
    return relativeSpecifier(fileName, specifier.slice(SOURCE_ALIAS.length));
  }
  if (HOST_RUNTIME_SPECIFIERS.has(specifier)) {
    return hostRuntimeModule(specifier);
  }
  return specifier;
};

const publishedImports = (fileName: string): PluginObj => ({
  visitor: {
    'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration': (declarationPath) => {
      const source = (declarationPath.node as { source?: { value: string } | null }).source;
      if (source) {
        source.value = publishedSpecifier(source.value, fileName);
      }
    },
  },
});

/**
 * The options OpenCode itself compiles a local TUI plugin with, since it compiles nothing inside
 * node_modules and plain JSX would drop Solid's reactivity
 */
const compile = async (fileName: string): Promise<string> => {
  const result = await transformAsync(await readFile(path.join(SOURCE_DIRECTORY, fileName), 'utf8'), {
    filename: fileName,
    configFile: false,
    babelrc: false,
    plugins: [() => publishedImports(fileName)],
    presets: [
      ['babel-preset-solid', { moduleName: hostRuntimeModule('@opentui/solid'), generate: 'universal' }],
      [
        '@babel/preset-typescript',
        { allExtensions: true, isTSX: fileName.endsWith('.tsx'), onlyRemoveTypeImports: false },
      ],
    ],
  });
  if (result?.code == null) {
    throw new Error(`Babel produced nothing for ${fileName}`);
  }
  return result.code;
};

/**
 * Paths relative to src, with forward slashes whatever the platform, since they become import specifiers
 */
const sourceFileNames = async (): Promise<string[]> =>
  (await readdir(SOURCE_DIRECTORY, { recursive: true }))
    .filter((fileName) => TYPESCRIPT_EXTENSION.test(fileName))
    .map((fileName) => fileName.split(path.sep).join('/'));

const writeCompiled = async (fileName: string): Promise<void> => {
  const outputPath = path.join(OUTPUT_DIRECTORY, publishedFileName(fileName));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await compile(fileName));
};

await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
for (const fileName of await sourceFileNames()) {
  await writeCompiled(fileName);
}
