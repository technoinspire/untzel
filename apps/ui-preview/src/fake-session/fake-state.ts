// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The fake session's one state: the tracks, the transport, the song and the text, the
// clock, and who hears about a change. Every intent family edits it; the view reads it.

import type { CodeState, InterfaceChange, TextRange } from "@untzel/editor";
import type { Diagnostic } from "@untzel/language";
import type { PlaybackMode } from "@untzel/session";
import type { StageMode } from "@untzel/light";
import type { AppPhase, ExportStatus, PlayRangeValue, ReceivedNotice, SongPartView, StepView, UntzelView } from "@untzel/presentation/view-model";
import { FAKE_FIRST_TEMPLATE } from "./fake-templates";
import { stepsOf, type Fixture, type TrackFixture } from "./fixtures";
import { indexTracks, unknownMembers, type IndexedTrack } from "../source-index";

export type Listener<T> = (value: T) => void;

export interface TrackState {
  name: string;
  instrument: string;
  fixture: TrackFixture;
  /** Bar 1; always patternBars[0]. */
  steps: StepView[];
  patternBars: StepView[][];
  isOn: boolean;
  isQueued: boolean;
  isMuted: boolean;
  /** Scale lock off (`free`). */
  isFree?: boolean;
  tone: number;
}

export interface FakeOptions {
  readonly fixture: Fixture;
  readonly phase: AppPhase;
  readonly mode: PlaybackMode;
  /** Freezes the transport at the wireframe's values (bar 21 of 56, 62 %). */
  readonly still: boolean;
  readonly exportProgress: number | null;
  readonly withError: boolean;
  readonly withChange: boolean;
  /** ?template=<name>; the chip selected on the idle screen. */
  readonly template?: string | null;
  readonly exportStatus?: ExportStatus;
  readonly shareLink?: "ready" | "too-long";
  readonly notice?: ReceivedNotice;
}

/** ?still=1: the clock stops here, and every audible track gets one cue just before it. */
export const STILL_SECONDS = 12;

/** Name, fixture and bars of a track; steps is always the first bar. */
export function trackStateOf(fixture: TrackFixture, patternBars: StepView[][]): Pick<TrackState, "name" | "instrument" | "fixture" | "steps" | "patternBars"> {
  return { name: fixture.name, instrument: fixture.instrument, fixture, steps: patternBars[0] ?? [], patternBars };
}

function withUnknownMember(fixture: Fixture): string {
  const lines = fixture.source.split("\n");
  const index = fixture.error.line - 1;
  lines[index] = `${lines[index] ?? ""} ${fixture.error.word}2`;
  return lines.join("\n");
}

export class FakeState {
  readonly fixture: Fixture;
  readonly still: boolean;
  readonly notice: ReceivedNotice | null;
  readonly startedAt = performance.now() / 1000;
  phase: AppPhase;
  mode: PlaybackMode;
  isPlaying = true;
  tracks: TrackState[];
  sections: { name: string; tracks: string[] }[];
  parts: SongPartView[];
  copiedBar: StepView[] | null = null;
  /** The play range of each mode, as the preview draws it; it does not move the fake music. */
  ranges: Record<PlaybackMode, PlayRangeValue | null> = { loop: null, song: null };
  loopBars: number;
  solo: string | null = null;
  /** The preview's project: renamed in place, the rest of the library is a fixed list. */
  title = "Midnight Coast";
  template: string;
  templateStyle: string | null = null;
  source: string;
  indexed: readonly IndexedTrack[];
  history: string[] = [];
  future: string[] = [];
  change: InterfaceChange | null = null;
  changeId = 0;
  readonly viewListeners = new Set<Listener<UntzelView>>();
  readonly codeListeners = new Set<Listener<CodeState>>();
  readonly soundingListeners = new Set<Listener<readonly TextRange[]>>();
  readonly announcementListeners = new Set<Listener<string>>();
  readonly modeListeners = new Set<Listener<StageMode>>();
  readonly #view: () => UntzelView;

  /** `view` is late-bound: the view reads the export and share sheets made after the state. */
  constructor(options: FakeOptions, view: () => UntzelView) {
    this.#view = view;
    this.fixture = options.fixture;
    this.still = options.still;
    this.phase = options.phase;
    this.mode = options.mode;
    this.notice = options.notice ?? null;
    this.template = options.template ?? FAKE_FIRST_TEMPLATE;
    this.source = options.withError ? withUnknownMember(options.fixture) : options.fixture.source;
    this.indexed = indexTracks(this.source);
    this.loopBars = options.fixture.loopBars;
    this.tracks = options.fixture.tracks.map((fixture) => ({
      ...trackStateOf(fixture, Array.from({ length: fixture.bars ?? 1 }, () => stepsOf(fixture.pattern))),
      isOn: options.fixture.loopOn.includes(fixture.name),
      isQueued: fixture.name === options.fixture.queued,
      isMuted: false,
      tone: fixture.tone,
    }));
    this.sections = options.fixture.sections.map((section) => ({ name: section.name, tracks: [...section.tracks] }));
    this.parts = [...options.fixture.parts];
    if (options.withChange) this.change = { id: ++this.changeId, ...options.fixture.change };
  }

  /** The heard clock the stage compares cues with; frozen with ?still=1, so the light is one fixed frame. */
  now(): number {
    return this.still ? STILL_SECONDS : performance.now() / 1000 - this.startedAt;
  }

  barSeconds(): number {
    return (60 / this.fixture.bpm) * 4;
  }

  track(name: string): TrackState | undefined {
    return this.tracks.find((track) => track.name === name);
  }

  freeName(base: string): string {
    if (!this.tracks.some((track) => track.name === base)) return base;
    let index = 2;
    while (this.tracks.some((track) => track.name === `${base}${index}`)) index += 1;
    return `${base}${index}`;
  }

  code(): CodeState {
    // The fake lights the steps of the text as it is, so the ranges point into it.
    return { source: this.source, programSource: this.source, diagnostics: this.diagnostics(), lastChange: this.change };
  }

  diagnostics(): readonly Diagnostic[] {
    return unknownMembers(this.source).map((entry) => ({
      code: "UNKNOWN_TRACK",
      message: entry.message,
      messageKey: "unknownTrack",
      messageArgs: [entry.section, entry.track],
      from: entry.from,
      to: entry.to,
      severity: "error",
    }));
  }

  setSource(source: string, isTyping: boolean): void {
    this.source = source;
    this.indexed = indexTracks(source);
    const diagnostics = this.diagnostics();
    if (diagnostics.length > 0 && isTyping) this.announce(`${diagnostics[0]?.message ?? ""} The previous version keeps playing.`);
    this.emitCode();
  }

  /** A control edited a track: the editor's "Line N changed" notice, then the screens. */
  noteChange(track: TrackState, what: string, value: string): void {
    const line = this.indexed.find((entry) => entry.name === track.name)?.line ?? track.fixture.line;
    this.change = { id: ++this.changeId, line, message: `Line ${line} changed by the ${track.name} track: ${what} became ${value}.` };
    this.emitCode();
    this.emit();
  }

  announce(message: string): void {
    for (const listener of this.announcementListeners) listener(message);
  }

  emit(): void {
    const view = this.#view();
    for (const listener of this.viewListeners) listener(view);
  }

  emitCode(): void {
    const state = this.code();
    for (const listener of this.codeListeners) listener(state);
  }

  stageMode(): StageMode {
    if (this.phase === "load-failed" || this.phase === "unsupported") return "off";
    return this.phase === "running" && this.isPlaying ? "live" : "idle";
  }

  emitMode(): void {
    const mode = this.stageMode();
    for (const listener of this.modeListeners) listener(mode);
  }
}
