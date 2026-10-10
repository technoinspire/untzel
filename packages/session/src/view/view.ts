// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  buildArrangement,
  loopLengthOf,
  toNumber,
  type Curve,
  type EffectKind,
  type LoopLength,
  type Key,
  type Program,
  type ResolvedParameter,
  type SignalShape,
  type SourceRange,
  type Track,
} from "@untzel/core";
import { patternContent, type Diagnostic, type PatternContent } from "@untzel/language";
import type { PlaybackMode, PlaybackPosition } from "@untzel/transport";
import type { LoadReading } from "../ports";
import type { TrackPreview } from "../audition/track-preview";
import { songTempoOf, trackPreviewView, type TrackPreviewView } from "./view-preview";
import { patternRange, stepsOf, type StepView } from "./view-steps";

// Read-only projection of the session for adapters (controls, editor, visual). Plain
// data, rebuilt on every change; adapters never derive it from the text themselves.

/**
 * "on"/"off": the text and what sounds agree. "queued-on"/"queued-off": the text
 * changed and the sound follows on the next bar boundary.
 */
export type TrackStatus = "on" | "off" | "queued-on" | "queued-off";

export type { StepView } from "./view-steps";

export interface SignalView {
  readonly shape: SignalShape;
  readonly periodBars: number;
  readonly low: number;
  readonly high: number;
  readonly from: number;
  readonly to: number;
  readonly curve: Curve;
}

export interface ParameterView {
  /** DSP index: general 0..8, effects 16..31, instrument 32+. */
  readonly index: number;
  readonly name: string;
  /** The constant value; null when a signal drives it. */
  readonly value: number | null;
  readonly signal: SignalView | null;
  /** Written in the text (wins over tone). */
  readonly explicit: boolean;
}

export interface TrackView {
  readonly name: string;
  readonly instrument: string;
  readonly status: TrackStatus;
  readonly muted: boolean;
  /** `free`: Scale lock is off and the notes are played as written. */
  readonly free: boolean;
  readonly soloed: boolean;
  /** Song mode while playing: listed in the current section. Null otherwise. */
  readonly inSection: boolean | null;
  /** Listed in the loop section (`section … | loop`); null when the text has none. */
  readonly inLoopSection: boolean | null;
  /** The named sound written after the instrument; null is the default one. */
  readonly preset: string | null;
  /** Insert effects in chain order. */
  readonly effects: readonly EffectKind[];
  /** 1-based line of the track in the text the program came from. */
  readonly line: number;
  readonly source: SourceRange;
  /** One array of steps per bar of the pattern cycle. */
  readonly bars: readonly (readonly StepView[])[];
  /** Where the pattern is written; null for a track without one. */
  readonly pattern: SourceRange | null;
  /** What the pattern plays (the language's patternContent), for Change sound. */
  readonly content: readonly PatternContent[];
  readonly parameters: readonly ParameterView[];
}

export interface SectionView {
  readonly name: string;
  readonly tracks: readonly string[];
  readonly tempo: number | null;
  readonly gain: number;
}

export interface SongPartView {
  readonly section: string;
  readonly bars: number;
  /** First bar of the part in one pass of the song. */
  readonly start: number;
}

export interface SongView {
  /** The declared song, or one 8-bar part per section when there is none. */
  readonly parts: readonly SongPartView[];
  readonly totalBars: number;
  readonly loop: boolean;
  /** False when the parts were synthesized from sections. */
  readonly declared: boolean;
  readonly currentPart: number | null;
}

export interface SessionView {
  readonly source: string;
  /**
   * The song title of the last valid program (`title "…"`); null for a text without a
   * title line. An empty title line keeps the title before it (EMPTY_TITLE).
   */
  readonly title: string | null;
  /** The current text analyzed without errors. */
  readonly valid: boolean;
  readonly playing: boolean;
  /** What sounds when playing (the transport's position), else the last requested mode. */
  readonly mode: PlaybackMode | null;
  /** bpm sounding now: the section tempo in song mode, else the program tempo. */
  readonly tempo: number | null;
  /** The global `tempo` line (the default when the text has none); what the tempo editor edits. */
  readonly songTempo: number | null;
  readonly key: Key | null;
  readonly tracks: readonly TrackView[];
  readonly sections: readonly SectionView[];
  /** The section written with `| loop`: what the loop mode plays. */
  readonly loopSection: string | null;
  readonly song: SongView | null;
  /** Loop mode's length: `loop <bars>`, or derived from the patterns (core's loopLengthOf). */
  readonly loop: LoopLength | null;
  readonly position: PlaybackPosition | null;
  readonly load: LoadReading;
  readonly diagnostics: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
  /**
   * The program that plays has no track (an empty text, or only comments): the transport
   * says "Nothing to play: add a track." instead of counting bars of silence.
   */
  readonly nothingToPlay: boolean;
  /** Source ranges of the events in the latest scheduled batch. */
  readonly sounding: readonly SourceRange[];
  readonly solo: string | null;
  /** A track playing a candidate pattern or sound that is not in the text yet. */
  readonly trackPreview: TrackPreviewView | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** Everything the projection reads; the session owns each field. */
export interface ViewInput {
  readonly source: string;
  readonly title: string | null;
  readonly valid: boolean;
  readonly program: Program | null;
  /** Text of `program`, for line numbers when the current text is invalid. */
  readonly programSource: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
  readonly playing: boolean;
  readonly mode: PlaybackMode | null;
  readonly position: PlaybackPosition | null;
  readonly load: LoadReading;
  readonly sounding: readonly SourceRange[];
  readonly solo: string | null;
  /** muted per track name as the transport plays it; a missing name is off. */
  readonly soundingMuted: ReadonlyMap<string, boolean>;
  readonly trackPreview: TrackPreview | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

// Over 40 lines: one literal of the SessionView, a field per line; each part is its own function.
export function projectView(input: ViewInput): SessionView {
  const { program, position } = input;
  const currentSection =
    input.playing && position?.mode === "song" && position.section !== null
      ? (program?.sections.find((section) => section.name === position.section) ?? null)
      : null;
  const loopSection = program?.sections.find((section) => section.isLoop) ?? null;
  return {
    source: input.source,
    title: input.title,
    valid: input.valid,
    playing: input.playing,
    mode: input.playing ? (position?.mode ?? input.mode) : input.mode,
    tempo: program === null ? null : toNumber(currentSection?.tempo ?? program.tempo),
    songTempo: songTempoOf(program),
    key: program?.key ?? null,
    tracks: (program?.tracks ?? []).map((track) => ({
      name: track.name,
      instrument: track.instrument,
      status: statusOf(track, input.soundingMuted),
      muted: track.muted,
      free: track.free,
      soloed: input.solo === track.name,
      inSection: currentSection === null ? null : currentSection.tracks.includes(track.name),
      inLoopSection: loopSection === null ? null : loopSection.tracks.includes(track.name),
      preset: track.preset,
      effects: track.effects,
      line: lineAt(input.programSource, track.source.from),
      source: track.source,
      bars: track.pattern.bars.map((bar) => bar.elements.flatMap(stepsOf)),
      pattern: patternRange(track),
      content: patternContent(track.pattern),
      parameters: track.parameters.map(parameterView),
    })),
    sections: (program?.sections ?? []).map((section) => ({
      name: section.name,
      tracks: section.tracks,
      tempo: section.tempo === null ? null : toNumber(section.tempo),
      gain: section.gain,
    })),
    loopSection: loopSection?.name ?? null,
    song: program === null ? null : songView(program, input),
    loop: program === null ? null : loopLengthOf(program),
    position: input.playing ? position : null,
    load: input.load,
    diagnostics: input.diagnostics,
    warnings: input.warnings,
    nothingToPlay: program !== null && program.tracks.length === 0,
    sounding: input.playing ? input.sounding : [],
    solo: input.solo,
    trackPreview: trackPreviewView(input.trackPreview),
    canUndo: input.canUndo,
    canRedo: input.canRedo,
  };
}

function statusOf(track: Track, soundingMuted: ReadonlyMap<string, boolean>): TrackStatus {
  const textOn = !track.muted;
  const soundOn = soundingMuted.get(track.name) === false;
  if (textOn === soundOn) return textOn ? "on" : "off";
  return textOn ? "queued-on" : "queued-off";
}

function parameterView(parameter: ResolvedParameter): ParameterView {
  const { value } = parameter;
  return {
    index: parameter.index,
    name: parameter.name,
    value: value.kind === "constant" ? value.value : null,
    signal:
      value.kind === "constant"
        ? null
        : {
            shape: value.signal.shape,
            periodBars: toNumber(value.signal.periodBars),
            low: value.low,
            high: value.high,
            from: value.from,
            to: value.to,
            curve: value.curve,
          },
    explicit: parameter.explicit,
  };
}

/** The arrangement the transport plays (@untzel/core), seen by the controls. */
function songView(program: Program, input: ViewInput): SongView | null {
  const arrangement = buildArrangement(program);
  if (arrangement === null) return null;
  const sounding = input.playing && input.position?.mode === "song";
  return {
    parts: arrangement.parts.map((part) => ({
      section: part.section.name,
      bars: part.bars,
      start: part.start,
    })),
    totalBars: arrangement.totalBars,
    loop: arrangement.loops,
    declared: arrangement.declared,
    currentPart: sounding ? (input.position?.partIndex ?? null) : null,
  };
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}
