// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Over 300 lines: the Session use case, the one owner of the text, the program and the play state; its commands share that state.

import type { Program, SourceRange } from "@untzel/core";
import type { Diagnostic } from "@untzel/language";
import type { PlaybackMode, PlaybackPosition, ScheduledBatch } from "@untzel/transport";
import { TextHistory, type EditOptions, type HistoryLabel } from "./history";
import type {
  LoadReading,
  SessionDependencies,
  SourceEditFailure,
  StartResult,
  Unsubscribe,
} from "../ports";
import { soundingProgram, type SoundingRecipe } from "../sounding-program";
import { TrackPreview } from "../audition/track-preview";
import { projectView, type SessionView } from "../view/view";

export type SessionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "NO_PROGRAM" | "SONG_UNAVAILABLE" };

export type CommandFailure =
  | "NO_PROGRAM"
  | "SONG_UNAVAILABLE"
  | "NOT_IN_SONG"
  | "NOT_IN_LOOP"
  | "UNKNOWN_PARAMETER"
  | "NOTHING_TO_UNDO"
  | "NOTHING_TO_REDO"
  /** Add part from what is playing, with every track off. */
  | "NOTHING_PLAYING"
  /** A preview candidate that does not analyze (broken manifest data). */
  | "INVALID_TEXT"
  /** applyTrackPreview: that candidate is not the one previewing. */
  | "NOT_PREVIEWING"
  | SourceEditFailure;

export type CommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: CommandFailure };

/** undo and redo: what the step changed, for the toast ("Undid: gain on hat"). */
export type HistoryResult =
  | { readonly ok: true; readonly label: HistoryLabel | null }
  | { readonly ok: false; readonly code: CommandFailure };

/** addTrack and duplicateTrack: the name the new track got (for example "hat2"). */
export type NamedCommandResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly code: CommandFailure };

export interface SessionState {
  readonly source: string;
  /** Last valid program; kept when the text becomes invalid. */
  readonly program: Program | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
  readonly mode: PlaybackMode | null;
  readonly playing: boolean;
}

/** muted per track as the text says, waiting for the bar boundary to sound. */
interface PendingMuted {
  readonly muted: ReadonlyMap<string, boolean>;
  /** Last position bar seen when it was loaded; commits on a later bar. */
  readonly sinceBar: number | null;
}

const OK = { ok: true } as const;
/** An empty title line keeps the last title; no title line has none. */
function titleOf(program: Program, warnings: readonly Diagnostic[], previous: string | null): string | null {
  if (program.title !== null) return program.title;
  return warnings.some((warning) => warning.code === "EMPTY_TITLE") ? previous : null;
}

function fail(code: CommandFailure): { readonly ok: false; readonly code: CommandFailure } {
  return { ok: false, code };
}

/**
 * The session's use cases. Main thread; touches no DOM, timer or console. Owns the invariant
 * "invalid text keeps the previous program": it alone decides whether to call load.
 * Gestures that change the text live in TrackEdits and come back through applyText,
 * the same analysis as typing.
 */
export class Session {
  readonly #dependencies: SessionDependencies;
  readonly #history = new TextHistory();
  readonly #listeners = new Set<(view: SessionView) => void>();
  readonly #subscriptions: Unsubscribe[];

  #source = "";
  #hasSource = false;
  #program: Program | null = null;
  #title: string | null = null;
  #programSource = "";
  #valid = false;
  #diagnostics: readonly Diagnostic[] = [];
  #warnings: readonly Diagnostic[] = [];
  #playing = false;
  #mode: PlaybackMode | null = null;
  #position: PlaybackPosition | null = null;
  #load: LoadReading;
  #sounding: readonly SourceRange[] = [];
  #solo: string | null = null;
  #soundingMuted: ReadonlyMap<string, boolean> = new Map();
  #pendingMuted: PendingMuted | null = null;
  #trackPreview: TrackPreview | null = null;
  #view: SessionView | null = null;

  constructor(dependencies: SessionDependencies) {
    this.#dependencies = dependencies;
    this.#load = dependencies.load.current();
    this.#subscriptions = [
      dependencies.sound.onPosition((position) => this.#onPosition(position)),
      dependencies.sound.onEnded(() => this.#onEnded()),
      ...(dependencies.schedule === undefined
        ? []
        : [dependencies.schedule.onBatch((batch) => this.#onBatch(batch))]),
    ];
  }

  start(): Promise<StartResult> {
    return this.#dependencies.sound.start();
  }

  /** Typing or a gesture: analyze, keep the text, and load only a valid program. */
  applyText(text: string, options: EditOptions = {}): void {
    this.#applyText(text, true, options);
  }

  /** Closes the open undo step: the next gesture is a step of its own (an editor closed, a drag ended). */
  endGesture(): void {
    this.#history.seal();
  }

  /**
   * The track plays `text`'s version of itself inside the music from the next bar, for
   * 16 bars, without the text changing (preview of an existing track). Stopped, it plays.
   */
  previewTrack(track: string, text: string, label: string): CommandResult {
    if (this.#program === null) return fail("NO_PROGRAM");
    if (this.#trackOf(track) === null) return fail("UNKNOWN_TRACK");
    const result = this.#dependencies.analyze(text);
    if (!result.ok) {
      this.#dependencies.log.internalError(text, new Error(result.diagnostics[0]?.message ?? "invalid preview"));
      return fail("INVALID_TEXT");
    }
    this.#trackPreview = new TrackPreview(track, text, result.program, label, this.#position?.bar ?? null);
    this.#loadSound();
    if (!this.#playing) return this.play(this.#mode ?? undefined);
    this.#changed();
    return OK;
  }

  /**
   * Use: writes exactly what the preview of `label` on `track` played, one undo step.
   * NOT_PREVIEWING when that candidate is not the one previewing (the caller computes the edit).
   */
  applyTrackPreview(track: string, label: string, options: EditOptions = {}): CommandResult {
    const preview = this.#trackPreview;
    if (preview === null || preview.track !== track || preview.label !== label) return fail("NOT_PREVIEWING");
    this.#applyText(preview.text, true, options);
    return OK;
  }

  /** Cancel, Esc, closing the detail: the track goes back to the text on the next bar. */
  endTrackPreview(): void {
    if (this.#trackPreview === null) return;
    this.#trackPreview = null;
    this.#loadSound();
    this.#changed();
  }
  /** Another song (a project, a template): its own text with an empty history. */
  openText(text: string): void {
    this.#history.clear();
    this.#applyText(text, false);
  }

  play(mode?: PlaybackMode): SessionResult {
    const program = this.#program;
    if (program === null) return { ok: false, code: "NO_PROGRAM" };
    const resolved = mode ?? (program.sections.length > 0 ? "song" : "loop");
    if (resolved === "song" && program.sections.length === 0) {
      return { ok: false, code: "SONG_UNAVAILABLE" };
    }
    if (this.#playing) {
      this.#dependencies.sound.setMode(resolved);
    } else {
      this.#dependencies.sound.play(resolved);
      this.#syncMuted(); // play activates the current program at once
    }
    this.#playing = true;
    this.#mode = resolved;
    this.#changed();
    return { ok: true };
  }

  /**
   * Plays `mode` from `startBar` (0-based) at once, stopping first if it plays: the export
   * sheet's Listen. The play range is left as it is.
   */
  playFromBar(mode: PlaybackMode, startBar: number): SessionResult {
    const program = this.#program;
    if (program === null) return { ok: false, code: "NO_PROGRAM" };
    if (mode === "song" && program.sections.length === 0) return { ok: false, code: "SONG_UNAVAILABLE" };
    if (this.#playing) this.#dependencies.sound.stop();
    this.#dependencies.sound.play(mode, Math.max(0, Math.floor(startBar)));
    this.#syncMuted();
    this.#playing = true;
    this.#mode = mode;
    this.#changed();
    return { ok: true };
  }
  /** Playing: enters on the next 4-bar phrase. */
  setMode(mode: PlaybackMode): SessionResult {
    const program = this.#program;
    if (program === null) return { ok: false, code: "NO_PROGRAM" };
    if (mode === "song" && program.sections.length === 0) {
      return { ok: false, code: "SONG_UNAVAILABLE" };
    }
    if (this.#playing) this.#dependencies.sound.setMode(mode);
    this.#mode = mode;
    this.#changed();
    return { ok: true };
  }

  /** The DSP ramps the stop. */
  stop(): void {
    if (!this.#playing) return;
    this.#dependencies.sound.stop();
    this.#halted();
  }

  /** Held tile: solo while held, immediate; null releases. Never written to the text. */
  solo(track: string | null): CommandResult {
    if (track !== null) {
      if (this.#program === null) return fail("NO_PROGRAM");
      if (this.#trackOf(track) === null) return fail("UNKNOWN_TRACK");
    }
    if (this.#solo === track) return OK;
    this.#solo = track;
    this.#loadSound();
    this.#changed();
    return OK;
  }

  undo(): HistoryResult {
    const step = this.#history.undo(this.#source);
    if (step === null) return fail("NOTHING_TO_UNDO");
    this.#applyText(step.text, false);
    return { ok: true, label: step.label };
  }

  redo(): HistoryResult {
    const step = this.#history.redo(this.#source);
    if (step === null) return fail("NOTHING_TO_REDO");
    this.#applyText(step.text, false);
    return { ok: true, label: step.label };
  }

  state(): SessionState {
    return {
      source: this.#source,
      program: this.#program,
      diagnostics: this.#diagnostics,
      warnings: this.#warnings,
      mode: this.#mode,
      playing: this.#playing,
    };
  }

  /**
   * What a link or a shared file carries: the current text when it is valid, else the
   * last valid one (so whatever is shared always plays); null without a program.
   */
  shareableSource(): { readonly source: string; readonly isCurrent: boolean } | null {
    if (this.#program === null) return null;
    if (this.#valid) return { source: this.#source, isCurrent: true };
    return { source: this.#programSource, isCurrent: false };
  }

  /**
   * What sounds now, as text: analyzing `source` and `preview.text` and applying
   * soundingProgram gives the last program sent to load; null without a program.
   */
  soundingRecipe(): SoundingRecipe | null {
    const program = this.#program;
    if (program === null) return null;
    const preview = this.#trackPreview;
    const isLive = preview !== null && !preview.isStale(program);
    return {
      source: this.#programSource,
      solo: this.#solo,
      preview: isLive ? { track: preview.track, text: preview.text } : null,
    };
  }

  /** Read-only projection for adapters; the same object until something changes. */
  view(): SessionView {
    this.#view ??= projectView({
      source: this.#source,
      title: this.#title,
      valid: this.#valid,
      program: this.#program,
      programSource: this.#programSource,
      diagnostics: this.#diagnostics,
      warnings: this.#warnings,
      playing: this.#playing,
      mode: this.#mode,
      position: this.#position,
      load: this.#load,
      sounding: this.#sounding,
      solo: this.#solo,
      soundingMuted: this.#soundingMuted,
      trackPreview: this.#trackPreview,
      canUndo: this.#history.canUndo,
      canRedo: this.#history.canRedo,
    });
    return this.#view;
  }

  /** Called with the new view after every change; not called on subscribe. */
  subscribe(listener: (view: SessionView) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Detaches from the ports. */
  dispose(): void {
    for (const unsubscribe of this.#subscriptions) unsubscribe();
    this.#listeners.clear();
  }

  #applyText(text: string, record: boolean, options: EditOptions = {}): void {
    if (record && this.#hasSource && text !== this.#source) this.#history.record(this.#source, options.label ?? null, options.mergeKey ?? null);
    // Any change of the text ends a preview of an existing track: Use wrote it, or it is stale.
    if (text !== this.#source) this.#trackPreview = null;
    if (options.renamed !== undefined && this.#solo === options.renamed.from) this.#solo = options.renamed.to;
    this.#source = text;
    this.#hasSource = true;
    const result = this.#dependencies.analyze(text);
    if (result.ok) {
      this.#program = result.program;
      this.#programSource = text;
      this.#valid = true;
      this.#diagnostics = [];
      this.#warnings = result.warnings;
      this.#title = titleOf(result.program, result.warnings, this.#title);
      if (this.#solo !== null && this.#trackOf(this.#solo) === null) this.#solo = null;
      this.#loadSound();
      this.#expectMuted(result.program);
    } else {
      this.#valid = false;
      this.#diagnostics = result.diagnostics;
      this.#warnings = [];
      if ("internalError" in result) this.#dependencies.log.internalError(text, result.internalError);
    }
    this.#changed();
  }

  /** What plays: the program, with a track preview in it, then the solo applied over both. */
  #loadSound(): void {
    const program = this.#program;
    if (program === null) return;
    if (this.#trackPreview?.isStale(program) === true) this.#trackPreview = null;
    const preview = this.#trackPreview;
    this.#dependencies.sound.load(
      soundingProgram({ program, solo: this.#solo, preview: preview === null ? null : { track: preview.track, program: preview.program } }),
    );
  }

  /** Mute changes are structural: while playing they sound from the next bar. */
  #expectMuted(program: Program): void {
    const muted = new Map(program.tracks.map((track) => [track.name, track.muted]));
    const differs = [...muted].some(([name, value]) => this.#soundingMuted.get(name) !== value);
    if (this.#playing && differs) {
      this.#pendingMuted = { muted, sinceBar: this.#position?.bar ?? null };
    } else {
      this.#soundingMuted = muted;
      this.#pendingMuted = null;
    }
  }

  /** Not playing, or starting: what sounds is exactly the program. */
  #syncMuted(): void {
    const program = this.#program;
    this.#soundingMuted = new Map(program?.tracks.map((track) => [track.name, track.muted]));
    this.#pendingMuted = null;
  }

  #onPosition(position: PlaybackPosition): void {
    if (!this.#playing) return;
    this.#position = position;
    const pending = this.#pendingMuted;
    if (pending !== null && (pending.sinceBar === null || position.bar > pending.sinceBar)) {
      this.#soundingMuted = pending.muted;
      this.#pendingMuted = null;
    }
    if (this.#trackPreview?.endsAt(position.bar) === true) {
      this.#trackPreview = null;
      this.#loadSound();
    }
    this.#load = this.#dependencies.load.current();
    this.#changed();
  }

  #onBatch(batch: ScheduledBatch): void {
    if (!this.#playing || (batch.events.length === 0 && this.#sounding.length === 0)) return;
    this.#sounding = batch.events.map((event) => event.source);
    this.#changed();
  }

  #onEnded(): void {
    if (this.#playing) this.#halted();
  }

  #halted(): void {
    if (this.#trackPreview !== null) {
      this.#trackPreview = null;
      this.#loadSound();
    }
    this.#playing = false;
    this.#position = null;
    this.#sounding = [];
    this.#syncMuted();
    this.#changed();
  }

  #trackOf(name: string): Program["tracks"][number] | null {
    return this.#program?.tracks.find((track) => track.name === name) ?? null;
  }

  #changed(): void {
    this.#view = null;
    if (this.#listeners.size === 0) return;
    const view = this.view();
    for (const listener of this.#listeners) listener(view);
  }
}
