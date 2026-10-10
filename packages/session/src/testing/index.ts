// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Test doubles of the session ports. Exported by @untzel/session/testing; the
// dependency rule "testing-only-in-tests" keeps them out of production code.
import type { Program, StepPitch } from "@untzel/core";
import type { PlaybackMode, PlaybackPosition, PlayRangeChange, ScheduledBatch } from "@untzel/transport";
import type {
  ArrangementSourceEditor,
  DiagnosticsLog,
  LoadEstimate,
  LoadPort,
  LoadReading,
  NamedSourceEdit,
  PreviewPort,
  ScheduleFeed,
  SoundPort,
  SourceEdit,
  SourceEditor,
  StartResult,
  TitleSourceEditor,
  Unsubscribe,
} from "../ports";

export type SoundCall =
  | { readonly kind: "start" }
  | { readonly kind: "load"; readonly program: Program }
  | { readonly kind: "play"; readonly mode: PlaybackMode }
  | { readonly kind: "setMode"; readonly mode: PlaybackMode }
  | { readonly kind: "stop" }
  | { readonly kind: "setPlayRange"; readonly change: PlayRangeChange }
  | { readonly kind: "setMasterGain"; readonly value: number };

/** Records every call; emitPosition and emitEnded drive the listeners. */
/** Records auditions; `end()` plays the worker's previewEnded. */
export class FakePreviewPort implements PreviewPort {
  readonly previews: Program[] = [];
  stops = 0;
  readonly #ended = new Set<() => void>();
  preview(program: Program): void {
    this.previews.push(program);
  }
  readonly notes: { readonly program: Program; readonly midis: readonly number[]; readonly seconds: number }[] = [];
  previewNote(program: Program, midis: readonly number[], seconds: number): void {
    this.notes.push({ program, midis, seconds });
  }
  stopPreview(): void {
    this.stops += 1;
  }
  onPreviewEnded(listener: () => void): Unsubscribe {
    this.#ended.add(listener);
    return () => this.#ended.delete(listener);
  }
  end(): void {
    for (const listener of this.#ended) listener();
  }
}

export class FakeSoundPort implements SoundPort {
  readonly calls: SoundCall[] = [];
  startResult: StartResult = { ok: true };
  readonly #positionListeners = new Set<(position: PlaybackPosition) => void>();
  readonly #endedListeners = new Set<() => void>();

  start(): Promise<StartResult> {
    this.calls.push({ kind: "start" });
    return Promise.resolve(this.startResult);
  }

  load(program: Program): void {
    this.calls.push({ kind: "load", program });
  }

  play(mode: PlaybackMode): void {
    this.calls.push({ kind: "play", mode });
  }

  setMode(mode: PlaybackMode): void {
    this.calls.push({ kind: "setMode", mode });
  }

  stop(): void {
    this.calls.push({ kind: "stop" });
  }

  setPlayRange(change: PlayRangeChange): void {
    this.calls.push({ kind: "setPlayRange", change });
  }

  /** Programs handed to load, in order. */
  loads(): Program[] {
    return this.calls.flatMap((call) => (call.kind === "load" ? [call.program] : []));
  }

  setMasterGain(value: number): void {
    this.calls.push({ kind: "setMasterGain", value });
  }

  onPosition(listener: (position: PlaybackPosition) => void): Unsubscribe {
    this.#positionListeners.add(listener);
    return () => this.#positionListeners.delete(listener);
  }

  onEnded(listener: () => void): Unsubscribe {
    this.#endedListeners.add(listener);
    return () => this.#endedListeners.delete(listener);
  }

  emitPosition(position: PlaybackPosition): void {
    for (const listener of this.#positionListeners) listener(position);
  }

  emitEnded(): void {
    for (const listener of this.#endedListeners) listener();
  }
}

export class FakeLoadPort implements LoadPort {
  estimateResult: LoadEstimate = { units: 0, fraction: null };
  reading: LoadReading = { fraction: null, calibrated: false };

  estimate(program: Program): LoadEstimate {
    void program;
    return this.estimateResult;
  }

  current(): LoadReading {
    return this.reading;
  }
}

export class FakeDiagnosticsLog implements DiagnosticsLog {
  readonly errors: { readonly source: string; readonly error: unknown }[] = [];

  internalError(source: string, error: unknown): void {
    this.errors.push({ source, error });
  }
}

/** emit drives the listeners like the worker's batch messages. */
export class FakeScheduleFeed implements ScheduleFeed {
  readonly #listeners = new Set<(batch: ScheduledBatch) => void>();

  onBatch(listener: (batch: ScheduledBatch) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(batch: ScheduledBatch): void {
    for (const listener of this.#listeners) listener(batch);
  }
}

export type EditCall = { readonly method: keyof SourceEditor | keyof ArrangementSourceEditor; readonly args: readonly unknown[] };

/**
 * Records every edit request. Each call returns `result` when set, otherwise the source
 * unchanged; tests set `result` to the text the real editor would produce.
 */
export class FakeSourceEditor implements SourceEditor, ArrangementSourceEditor {
  readonly calls: EditCall[] = [];
  result: SourceEdit | null = null;
  /** Name returned by addTrack and duplicateTrack. */
  createdName = "new";
  /** Text readBar returns; the call is recorded like the edits. */
  barText: string | null = "x... x... x... x...";

  setTrackMuted(source: string, track: string, muted: boolean): SourceEdit {
    return this.#record(source, "setTrackMuted", [track, muted]);
  }

  dropEdit(source: string): SourceEdit {
    return this.#record(source, "dropEdit", []);
  }
  toggleLoopMember(source: string, track: string): SourceEdit {
    return this.#record(source, "toggleLoopMember", [track]);
  }

  setTrackParameter(source: string, track: string, parameter: string, value: number): SourceEdit {
    return this.#record(source, "setTrackParameter", [track, parameter, value]);
  }

  toggleStep(source: string, track: string, bar: number, step: number, note?: string): SourceEdit {
    return this.#record(source, "toggleStep", note === undefined ? [track, bar, step] : [track, bar, step, note]);
  }

  setStepPitch(source: string, track: string, bar: number, step: number, pitch: StepPitch): SourceEdit {
    return this.#record(source, "setStepPitch", [track, bar, step, pitch]);
  }

  setTrackFree(source: string, track: string, free: boolean): SourceEdit {
    return this.#record(source, "setTrackFree", [track, free]);
  }

  addTrack(source: string, instrument: string, sound: string | null, pattern: string | null = null): NamedSourceEdit {
    const args = pattern !== null ? [instrument, sound, pattern] : sound === null ? [instrument] : [instrument, sound];
    return this.#named(this.#record(source, "addTrack", args));
  }
  removeTrackParameters(source: string, track: string, parameters: readonly string[]): SourceEdit {
    return this.#record(source, "removeTrackParameters", [track, parameters]);
  }

  duplicateTrack(source: string, track: string): NamedSourceEdit {
    return this.#named(this.#record(source, "duplicateTrack", [track]));
  }

  renameTrack(source: string, track: string, newName: string): SourceEdit {
    return this.#record(source, "renameTrack", [track, newName]);
  }

  deleteTrack(source: string, track: string): SourceEdit {
    return this.#record(source, "deleteTrack", [track]);
  }

  setSectionMembership(source: string, section: string, track: string, member: boolean): SourceEdit {
    return this.#record(source, "setSectionMembership", [section, track, member]);
  }

  setLoopBars(source: string, bars: number): SourceEdit {
    return this.#record(source, "setLoopBars", [bars]);
  }

  setTrackBars(source: string, track: string, bars: number): SourceEdit {
    return this.#record(source, "setTrackBars", [track, bars]);
  }

  setStepCount(source: string, track: string, count: number, hold: boolean): SourceEdit {
    return this.#record(source, "setStepCount", [track, count, hold]);
  }

  readBar(_source: string, track: string, bar: number): string | null {
    this.calls.push({ method: "readBar", args: [track, bar] });
    return this.barText;
  }

  replaceBar(source: string, track: string, bar: number, text: string): SourceEdit {
    return this.#record(source, "replaceBar", [track, bar, text]);
  }

  clearBar(source: string, track: string, bar: number, separate: boolean): SourceEdit {
    return this.#record(source, "clearBar", [track, bar, separate]);
  }

  setPartBars(source: string, part: number, bars: number): SourceEdit {
    return this.#record(source, "setPartBars", [part, bars]);
  }

  movePart(source: string, part: number, delta: -1 | 1): SourceEdit {
    return this.#record(source, "movePart", [part, delta]);
  }

  duplicatePart(source: string, part: number): SourceEdit {
    return this.#record(source, "duplicatePart", [part]);
  }

  declareSong(source: string, parts: readonly { readonly section: string; readonly bars: number }[]): SourceEdit {
    return this.#record(source, "declareSong", [parts]);
  }

  addSection(source: string, tracks: readonly string[], bars: number): NamedSourceEdit {
    return this.#named(this.#record(source, "addSection", [tracks, bars]));
  }
  renameSection(source: string, section: string, newName: string): SourceEdit {
    return this.#record(source, "renameSection", [section, newName]);
  }

  #record(source: string, method: keyof SourceEditor | keyof ArrangementSourceEditor, args: readonly unknown[]): SourceEdit {
    this.calls.push({ method, args });
    return this.result ?? { ok: true, source };
  }

  #named(edit: SourceEdit): NamedSourceEdit {
    return edit.ok ? { ...edit, name: this.createdName } : edit;
  }
}
/** Records the titles asked for; answers with `result`, else a title line on top. */
export class FakeTitleEditor implements TitleSourceEditor {
  readonly titles: string[] = [];
  result: SourceEdit | null = null;
  setTitleEdit(source: string, title: string): SourceEdit {
    this.titles.push(title);
    return this.result ?? { ok: true, source: `title "${title}"\n${source}` };
  }
}

export { MemoryProjectStore } from "./memory-project-store";
