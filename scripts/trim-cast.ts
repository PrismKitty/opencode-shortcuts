#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const LEAVE_ALTERNATE_SCREEN = '\u001b[?1049l';
const FINAL_HOLD_SECONDS = 2;

type CastEvent = [interval: number, type: string, data: string];

const isExit = (line: string): boolean => {
  const [, type, data] = JSON.parse(line) as CastEvent;
  return type === 'o' && data.includes(LEAVE_ALTERNATE_SCREEN);
};

/**
 * Cuts the recording where OpenCode leaves the alternate screen, which clears it, and holds the last
 * real frame instead
 */
const trimmed = (cast: string): string => {
  const [header, ...events] = cast.trimEnd().split('\n');
  const exitIndex = events.findIndex(isExit);
  const kept = exitIndex === -1 ? events : events.slice(0, exitIndex);
  return [header, ...kept, JSON.stringify([FINAL_HOLD_SECONDS, 'o', ''])].join('\n') + '\n';
};

const [inputPath, outputPath] = process.argv.slice(2);
if (inputPath === undefined || outputPath === undefined) {
  throw new Error('usage: node scripts/trim-cast.ts <input.cast> <output.cast>');
}
await writeFile(outputPath, trimmed(await readFile(inputPath, 'utf8')));
