import type { CliRenderer } from '@opentui/core';
import { createSignal, onCleanup } from 'solid-js';

export const useTerminalSize = (renderer: CliRenderer) => {
  const [size, setSize] = createSignal({ width: renderer.width, height: renderer.height });
  const updateSize = (width: number, height: number) => setSize({ width, height });
  renderer.on('resize', updateSize);
  onCleanup(() => renderer.off('resize', updateSize));
  return size;
};
