import { homedir } from 'node:os';
import path from 'node:path';
import { createSignal, onCleanup, onMount } from 'solid-js';

import type { Host, KeybindStore } from '#src/host/types.ts';
import {
  isShowCommand,
  withClosedMenusMarked,
  withCurrentKeys,
  withKeysAwaitingRestart,
  type ShortcutEntry,
} from '#src/shortcuts/entries.ts';
import { canonicalSequence, splitBinding } from '#src/shortcuts/keys.ts';
import {
  canRebind,
  findClashOwner,
  isApplied,
  planRebind,
  resolutionsFor,
  withPlannedKeys,
  type ClashResolution,
  type KeyChange,
  type RebindMode,
} from '#src/shortcuts/rebind.ts';
import { configuredLeader, readConfig } from '#src/storage/config-file.ts';
import { overridingConfigPaths } from '#src/storage/overrides.ts';
import { isCustomised, saveAndVerify, textWithChanges, textWithReset, type SaveOutcome } from '#src/storage/save.ts';
import { captureChords } from '#src/ui/rebinding/capture-chords.ts';
import {
  alreadyDefaultNotice,
  cannotRebindNotice,
  overriddenNotice,
  readFailureNotice,
  reboundText,
  resetText,
  saveNotice,
  type Notice,
} from '#src/ui/rebinding/notices.ts';
import { stepAfterChord, type Step } from '#src/ui/rebinding/steps.ts';

interface RebindingSetup {
  host: Host;
  entries: readonly ShortcutEntry[];
  store: KeybindStore;
  keysAwaitingRestart: () => ReadonlyMap<string, readonly string[]>;
  setKeysAwaitingRestart: (keysByCommand: ReadonlyMap<string, readonly string[]>) => void;
  onConfigWritten: (text: string) => void;
  setRecording: (isRecording: boolean) => void;
}

interface PendingSave {
  target: ShortcutEntry;
  edit: (text: string) => string | undefined; // undefined when the config file has nowhere to put the change
  isApplied: () => boolean;
  successText: (saved: ShortcutEntry) => string;
  changes: readonly KeyChange[];
}

/**
 * Undefined when OpenCode reports no keys to check a save against, so the save is taken on trust
 */
const verifiableCommandID = (store: KeybindStore, entry: ShortcutEntry): string | undefined =>
  isShowCommand(entry) || entry.appliesNextOpen || store.appliesAfterRestart ? undefined : entry.commandID;

/**
 * This plugin's own key lives in its layer, which takes a new key at once
 */
const awaitsRestart = (store: KeybindStore, entry: ShortcutEntry): boolean =>
  store.appliesAfterRestart && !isShowCommand(entry);

export const useRebinding = (setup: RebindingSetup) => {
  const { host, store } = setup;
  const [entries, setEntries] = createSignal<readonly ShortcutEntry[]>(setup.entries);
  const [configText, setConfigText] = createSignal('');
  const [step, setStep] = createSignal<Step>({ kind: 'browsing' });
  const [notice, setNotice] = createSignal<Notice>();
  const leader = () => configuredLeader(configText());
  let stopRecording: (() => void) | undefined;
  onMount(() => {
    void readConfig(store.path, store.emptyText).then(setConfigText, (cause) =>
      setNotice(readFailureNotice(path.basename(store.path), cause)),
    );
  });
  onMount(() => setEntries(withClosedMenusMarked(entries(), host.commands())));
  onCleanup(() => stopRecording?.());
  const finish = (message?: Notice) => {
    setStep({ kind: 'browsing' });
    setNotice(message);
  };
  const handleRecordedChord = (chord: string) => {
    const current = step();
    if (current.kind !== 'recording') {
      return;
    }
    const next = stepAfterChord(current, chord, canonicalSequence(leader(), leader()));
    if (next.kind === 'recording') {
      setStep(next);
      return;
    }
    stopRecording?.();
    if (next.kind === 'browsing') {
      finish();
      return;
    }
    setStep(next);
  };
  const startRecording = (target: ShortcutEntry) => {
    if (!canRebind(target, store.configKey)) {
      setNotice(cannotRebindNotice(target.title));
      return;
    }
    setNotice(undefined);
    setStep({ kind: 'recording', target, afterLeader: false });
    const stopCapture = captureChords(host, handleRecordedChord);
    setup.setRecording(true);
    stopRecording = () => {
      stopCapture();
      setup.setRecording(false);
      stopRecording = undefined;
    };
  };
  const startReset = (target: ShortcutEntry) => {
    if (!isCustomised(store, configText(), target)) {
      setNotice(alreadyDefaultNotice(target.title));
      return;
    }
    setNotice(undefined);
    setStep({ kind: 'resetting', target });
  };
  const isChangeApplied = (change: KeyChange) => {
    const commandID = verifiableCommandID(store, change.entry);
    return commandID === undefined || isApplied(change, host.shortcuts(commandID), leader());
  };
  const onWrite = (text: string) => {
    setConfigText(text);
    setup.onConfigWritten(text);
  };
  const rememberKeysAwaitingRestart = (taken: readonly KeyChange[], overridden: readonly KeyChange[]) => {
    const keysByCommand = new Map(setup.keysAwaitingRestart());
    for (const { entry } of overridden) {
      if (entry.commandID !== undefined) {
        keysByCommand.delete(entry.commandID);
      }
    }
    for (const { entry, sequences } of taken) {
      if (entry.commandID !== undefined && awaitsRestart(store, entry)) {
        keysByCommand.set(entry.commandID, sequences);
      }
    }
    setup.setKeysAwaitingRestart(keysByCommand);
  };
  const noticeAfterSave = (
    outcome: SaveOutcome,
    pending: PendingSave,
    refreshed: readonly ShortcutEntry[],
    overridingPaths: readonly (string | undefined)[],
  ): Notice => {
    const savedEntry = (entry: ShortcutEntry) =>
      refreshed.find((candidate) => candidate.rowID === entry.rowID) ?? entry;
    const successText = pending.successText(savedEntry(pending.target));
    const overriddenIndex = overridingPaths.findIndex((overridingPath) => overridingPath !== undefined);
    const overridden = pending.changes[overriddenIndex];
    const overridingPath = overridingPaths[overriddenIndex];
    if (overridden === undefined || overridingPath === undefined) {
      return saveNotice(outcome, path.basename(store.path), pending.target.title, successText);
    }
    const precedingText = overridden.entry.rowID === pending.target.rowID ? '' : successText;
    return overriddenNotice(precedingText, savedEntry(overridden.entry), overridingPath, process.cwd(), homedir());
  };
  const save = async (pending: PendingSave) => {
    setStep({ kind: 'saving', target: pending.target });
    const outcome = await saveAndVerify({ store, edit: pending.edit, isApplied: pending.isApplied, onWrite });
    const isSaved = outcome.kind === 'saved';
    const overridingPaths = isSaved ? await overridingConfigPaths(store, pending.changes) : [];
    const taken = pending.changes.filter((_change, index) => overridingPaths[index] === undefined);
    if (isSaved) {
      rememberKeysAwaitingRestart(
        taken,
        pending.changes.filter((change) => !taken.includes(change)),
      );
    }
    const current = withKeysAwaitingRestart(withCurrentKeys(entries(), host.shortcuts), setup.keysAwaitingRestart());
    const unconfirmed = taken.filter((change) => change.entry.appliesNextOpen);
    const refreshed = isSaved ? withPlannedKeys(current, unconfirmed) : current;
    setEntries(refreshed);
    finish(noticeAfterSave(outcome, pending, refreshed, overridingPaths));
  };
  const rebind = (mode: RebindMode, resolution?: ClashResolution) => {
    const current = step();
    if (current.kind !== 'confirming' && current.kind !== 'clashing') {
      return;
    }
    const owner =
      current.kind === 'clashing'
        ? current.owner
        : findClashOwner(
            entries().filter((entry) => entry.appliesNextOpen === current.target.appliesNextOpen),
            current.target,
            current.sequence,
            leader(),
          );
    if (owner !== undefined && resolution === undefined) {
      setStep({
        kind: 'clashing',
        target: current.target,
        sequence: current.sequence,
        mode,
        owner,
        resolutions: resolutionsFor(owner, mode, store.configKey),
      });
      return;
    }
    const clash = owner === undefined || resolution === undefined ? undefined : { owner, resolution };
    const changes = planRebind({ target: current.target, sequence: current.sequence, mode, clash }, leader());
    void save({
      target: current.target,
      edit: (text) => textWithChanges(store, text, changes, leader()),
      isApplied: () => changes.every(isChangeApplied),
      successText: reboundText,
      changes,
    });
  };
  const defaultSequences = (entry: ShortcutEntry): string[] => {
    const binding = entry.commandID === undefined ? undefined : store.defaultBinding(entry.commandID);
    return splitBinding(binding ?? '').map((sequence) => canonicalSequence(sequence, leader()));
  };
  const reset = () => {
    const current = step();
    if (current.kind !== 'resetting') {
      return;
    }
    const { target } = current;
    const commandID = verifiableCommandID(store, target);
    const keysBefore = commandID === undefined ? '' : host.shortcuts(commandID).join();
    void save({
      target,
      edit: (text) => textWithReset(store, text, target),
      isApplied: () => commandID === undefined || host.shortcuts(commandID).join() !== keysBefore,
      successText: resetText,
      changes: [{ entry: target, sequences: defaultSequences(target) }],
    });
  };
  return {
    entries,
    step,
    notice,
    leader,
    isCustomised: (entry: ShortcutEntry) => isCustomised(store, configText(), entry),
    startRecording,
    startReset,
    rebind,
    reset,
    cancel: () => finish(),
  };
};
