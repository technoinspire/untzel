// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Key, Program, ScaleName, StepPitch } from "@untzel/core";
import type { AuditionSound } from "./audition/audition";
import type { AnalyzeResult, EditFailure } from "@untzel/language";
import type { PlaybackMode, PlaybackPosition, PlayRange, PlayRangeChange, ScheduledBatch } from "@untzel/transport";

// Every port adapters implement is reachable from here. ClockPort and EventSink are
// defined in @untzel/transport and re-exported.
export type {
  ActivatedModulator,
  ActivatedTrack,
  BeatGrid,
  ClockPort,
  EventSink,
  ParameterPoint,
  PlaybackMode,
  PlaybackPosition,
  PlayRange,
  PlayRangeChange,
  PreviewSink,
  RangePartNames,
  ProgramActivation,
  ScheduledBatch,
  ScheduledEvent,
  TempoChange,
  TransportStats,
} from "@untzel/transport";

export type StartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "unsupported" | "blocked" | "load-failed" };

export type Unsubscribe = () => void;

export interface SoundPort {
  /** The context was already unlocked by the gesture. */
  start(): Promise<StartResult>;
  /** Hands a valid program to the transport. */
  load(program: Program): void;
  /** `startBar` (0-based, default the play range's start or 0): where playback begins. */
  play(mode: PlaybackMode, startBar?: number): void;
  setMode(mode: PlaybackMode): void;
  stop(): void;
  /** The play range of one mode: enters on the next bar (main → worker "setPlayRange"). */
  setPlayRange(change: PlayRangeChange): void;
  /** 20 ms ramp. */
  setMasterGain(value: number): void;
  onPosition(listener: (position: PlaybackPosition) => void): Unsubscribe;
  onEnded(listener: () => void): Unsubscribe;
}

/** The audition of the library: transient sound, never the text. */
export interface PreviewPort {
  /** Plays the first track of `program` in a loop, at most 16 bars, replacing any audition. */
  preview(program: Program): void;
  /** Note audition: `midis` on the first track of `program` now, off the grid, for `seconds`. */
  previewNote(program: Program, midis: readonly number[], seconds: number): void;
  stopPreview(): void;
  /** Every end of an audition, whatever ended it. */
  onPreviewEnded(listener: () => void): Unsubscribe;
}

export interface LoadEstimate {
  readonly units: number;
  readonly fraction: number | null;
}

/** fraction 1 = a full render quantum. */
export interface LoadReading {
  readonly fraction: number | null;
  readonly calibrated: boolean;
}

export interface LoadPort {
  /** Before adding a track. */
  estimate(program: Program): LoadEstimate;
  current(): LoadReading;
}

export interface DiagnosticsLog {
  internalError(source: string, error: unknown): void;
}

/** The batches the worker posts to the main thread, as objects. Feeds the sounding ranges. */
export interface ScheduleFeed {
  onBatch(listener: (batch: ScheduledBatch) => void): Unsubscribe;
}

/**
 * Why a minimal edit could not be made: the reasons of @untzel/language, plus
 * UNKNOWN_INSTRUMENT when the composition finds no manifest for addTrack.
 */
export type SourceEditFailure = EditFailure | "UNKNOWN_INSTRUMENT";

export type SourceEdit =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly reason: SourceEditFailure };

/** An edit that creates a track also says which name it got. */
export type NamedSourceEdit =
  | { readonly ok: true; readonly source: string; readonly name: string }
  | { readonly ok: false; readonly reason: SourceEditFailure };

/**
 * Minimal text edits over the syntax tree, preserving comments and formatting,
 * used by TrackEdits. Names and arguments follow
 * the edit functions of @untzel/language, so the composition binds them one to one
 * (addTrack resolves the manifest from the registry). Every result goes through the
 * same analysis as typing.
 */
export interface SourceEditor {
  /** Off: appends "| mute" to the line. On: removes "mute". */
  setTrackMuted(source: string, track: string, muted: boolean): SourceEdit;
  /**
   * Drop: removes "mute" from every track and, with a loop section, moves "| loop" to the
   * fullest section, in one edit.
   */
  dropEdit(source: string): SourceEdit;
  /** A track tap in loop mode with a loop section: joins it, unmutes it or leaves it. */
  toggleLoopMember(source: string, track: string): SourceEdit;
  /** Replaces or appends "| <parameter> <value>": a general, manifest or "tone" modifier. */
  setTrackParameter(source: string, track: string, parameter: string, value: number): SourceEdit;
  /**
   * `bar` and `step` index the cells of TrackView.bars. A lone rest becomes `note` when
   * given (pitched tracks), "x" otherwise.
   */
  toggleStep(source: string, track: string, bar: number, step: number, note?: string): SourceEdit;
  /** The note picker: a note, chord, hold or rest on a step, in one change. */
  setStepPitch(source: string, track: string, bar: number, step: number, pitch: StepPitch): SourceEdit;
  /** Scale lock off appends "| free"; on removes it. */
  setTrackFree(source: string, track: string, free: boolean): SourceEdit;
  /**
   * Inserts "<next free name>: <instrument> [<sound>] <pattern>" after the last track.
   * `sound` null writes none (the default); `pattern` is a pattern name of the manifest,
   * null its first, written in `key` (patternInKey).
   */
  addTrack(source: string, instrument: string, sound: string | null, pattern: string | null, key: Key | null): NamedSourceEdit;
  /** Removes every modifier with one of these names from the track, in one edit (Use Tone). */
  removeTrackParameters(source: string, track: string, parameters: readonly string[]): SourceEdit;
  /** Copies the line under the next free name (bass → bass2). */
  duplicateTrack(source: string, track: string): NamedSourceEdit;
  /** Renames the track and every section reference, in one edit. */
  renameTrack(source: string, track: string, newName: string): SourceEdit;
  /** Removes the line and the name from every section. */
  deleteTrack(source: string, track: string): SourceEdit;
  /** Inserts or removes the track name in the section line. */
  setSectionMembership(source: string, section: string, track: string, member: boolean): SourceEdit;
  /** Writes `loop <bars>` (1..16): replaces the number, or adds the line after the globals. */
  setLoopBars(source: string, bars: number): SourceEdit;
  /** Adds bars that repeat the last one, or drops the last bars ("/" separated). */
  setTrackBars(source: string, track: string, bars: number): SourceEdit;
  /** Resamples every bar to `count` steps; `hold` keeps note lengths (pitched tracks). */
  setStepCount(source: string, track: string, count: number, hold: boolean): SourceEdit;
  /** Copy bar: the elements of one bar as written; null when the bar does not exist. */
  readBar(source: string, track: string, bar: number): string | null;
  /** Paste here: the bar takes `text` (from readBar); anything that is not one bar fails. */
  replaceBar(source: string, track: string, bar: number, text: string): SourceEdit;
  /** Clear bar: the same steps, all rests; `separate` writes one "." per step (pitched). */
  clearBar(source: string, track: string, bar: number, separate: boolean): SourceEdit;
}

/** The song title, used by TitleEdits; bound to language's setTitleEdit. */
export interface TitleSourceEditor {
  /** Replaces the string of `title`, or inserts `title "…"` before the first statement. */
  setTitleEdit(source: string, title: string): SourceEdit;
}

/** The song's parts, used by SongEdits; bound like SourceEditor. */
export interface ArrangementSourceEditor {
  /** Replaces the bar count of one part of the song. */
  setPartBars(source: string, part: number, bars: number): SourceEdit;
  /** Swaps a part with the one before (-1) or after (+1). */
  movePart(source: string, part: number, delta: -1 | 1): SourceEdit;
  /** Inserts a copy of the part right after it. */
  duplicatePart(source: string, part: number): SourceEdit;
  /** Writes the song sections alone play; no change when the text has one. */
  declareSong(source: string, parts: readonly { readonly section: string; readonly bars: number }[]): SourceEdit;
  /** A new section ("part", "part2"…) with `tracks` and a part of `bars` at the end of the song. */
  addSection(source: string, tracks: readonly string[], bars: number): NamedSourceEdit;
  /** The section line and every use in the song, in one edit. */
  renameSection(source: string, section: string, newName: string): SourceEdit;
}

/** The song's tempo and key, used by StatementEdits; bound like SourceEditor. */
export interface StatementSourceEditor {
  /** 40..300 BPM: replaces the `tempo` value, or writes the line. */
  setTempo(source: string, bpm: number): SourceEdit;
  /** `tonic` as the text writes it ("c", "f#", "eb"). */
  setKey(source: string, tonic: string, scale: ScaleName): SourceEdit;
}

/** A named pattern of the manifest on an existing track. */
export interface PatternSourceEditor {
  /** Replaces the track's pattern with `pattern` of `instrument`'s manifest, in `key`. */
  setTrackPattern(source: string, track: string, instrument: string, pattern: string, key: Key | null): SourceEdit;
}

/**
 * Plays one short sound on a track's own instrument, preset, effects and gain, at once
 * and not quantized, whether the transport plays or not. Never
 * touches the text or the transport. apps/web implements it over the preview path
 * (PreviewNoteAudition on the library Audition's playNote, PreviewPort).
 */
export interface NoteAudition {
  audition(track: string, sound: AuditionSound, durationMs: number): void;
}

export interface SessionDependencies {
  readonly sound: SoundPort;
  readonly load: LoadPort;
  readonly log: DiagnosticsLog;
  /** The composition binds the registry. */
  readonly analyze: (source: string) => AnalyzeResult;
  /** Without it the view's sounding ranges stay empty. */
  readonly schedule?: ScheduleFeed;
}

/** A share link, or why there is none: the URL is longer than the safe limit. */
export type ShareLink =
  | { readonly kind: "link"; readonly url: string; readonly length: number }
  | { readonly kind: "too-long"; readonly length: number };

export interface SavedSession {
  readonly source: string;
  /** ISO 8601. */
  readonly savedAt: string;
}

/** Implemented by @untzel/share; used by the composition, never by the Session itself. */
export interface SourceStore {
  /**
   * `mode` is the sender's playback mode and `range` that mode's play range, carried beside
   * the text; a null mode leaves both out.
   */
  link(source: string, mode: PlaybackMode | null, range: PlayRange | null): Promise<ShareLink>;
  /** False when the browser refused (quota, privacy mode, no storage). */
  saveLocal(source: string): boolean;
  loadLocal(): SavedSession | null;
}
