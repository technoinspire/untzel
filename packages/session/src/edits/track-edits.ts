// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_LOOP_BARS, midiToNoteName, pitchClassName, stepGain, type InstrumentRegistry, type StepPitch } from "@untzel/core";
import type { EditOptions } from "../use-cases/history";
import { parameterValueAt } from "./parameter-fraction";
import { toneOverridesOf } from "../view/track-tone";
import type { NamedSourceEdit, SourceEdit, SourceEditor } from "../ports";
import type { CommandFailure, CommandResult, NamedCommandResult, Session } from "../use-cases/session";
import type { StepView, TrackView } from "../view/view";

/** A pitched step with no note nearby starts in this octave (c2 = 36, the bass register). */
export const DEFAULT_NOTE_OCTAVE = 2;
/** The track detail offers as many bars per pattern as a loop can have. */
export const MAX_TRACK_BARS = MAX_LOOP_BARS;
/** Steps per bar the track detail offers. */
export const STEP_COUNTS = [8, 16, 32] as const;

export interface TrackEditsDependencies {
  /** Owns the text: every edit is applied through applyText, like typing. */
  readonly session: Session;
  readonly editor: SourceEditor;
  /** Manifest curves for sliders, and which instruments are pitched. */
  readonly registry: InstrumentRegistry;
}

/** setParamFraction: the value the text got. */
export type ValueCommandResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: CommandFailure };

const OK = { ok: true } as const;

function fail(code: CommandFailure): { readonly ok: false; readonly code: CommandFailure } {
  return { ok: false, code };
}

/**
 * The gestures that change the text: track on/off, drop, tone and parameters, steps,
 * loop and pattern lengths, copying, pasting and clearing a bar, and adding, copying, renaming
 * and deleting tracks. Each one is a single minimal edit
 * (one applyText, one undo step) that goes through the same analysis as typing.
 */
export class TrackEdits {
  readonly #session: Session;
  readonly #editor: SourceEditor;
  readonly #registry: InstrumentRegistry;

  constructor(dependencies: TrackEditsDependencies) {
    this.#session = dependencies.session;
    this.#editor = dependencies.editor;
    this.#registry = dependencies.registry;
  }

  /**
   * On or off on the next bar boundary. In loop mode with a loop section the tap edits
   * the section; otherwise it writes or removes "| mute".
   */
  toggleTrack(track: string): CommandResult {
    const program = this.#session.state().program;
    const current = program?.tracks.find((entry) => entry.name === track);
    if (current === undefined) return fail("UNKNOWN_TRACK");
    const hasLoopSection = program?.sections.some((section) => section.isLoop) === true;
    // A session that has not played yet starts in loop mode (the first tap).
    if (hasLoopSection && (this.#session.view().mode ?? "loop") === "loop") {
      return this.#edit((source) => this.#editor.toggleLoopMember(source, track), on("mute", track));
    }
    return this.#edit((source) => this.#editor.setTrackMuted(source, track, !current.muted), on("mute", track));
  }

  /** Loop mode: removes every mute and moves the loop section to the fullest one, in one edit. */
  drop(): CommandResult {
    if (this.#session.state().program === null) return fail("NO_PROGRAM");
    if (this.#session.view().mode === "song") return fail("NOT_IN_LOOP");
    return this.#edit((source) => this.#editor.dropEdit(source), on("drop", null));
  }

  setTone(track: string, value: number): CommandResult {
    return this.setParam(track, "tone", value);
  }

  /** Any general or manifest modifier, by its text name, in parameter units. */
  setParam(track: string, parameter: string, value: number): CommandResult {
    // A drag is one step: edits of the same slider in a row fuse until endGesture.
    return this.#edit((source) => this.#editor.setTrackParameter(source, track, parameter, value), {
      label: { what: parameter, target: track },
      mergeKey: `parameter:${track}:${parameter}`,
    });
  }

  /**
   * A slider position 0..1: through the manifest curve, or linear for tone and the mix.
   * Returns the value written in the text.
   */
  setParamFraction(track: string, parameter: string, fraction: number): ValueCommandResult {
    const view = this.#track(track);
    if (view === undefined) return fail("UNKNOWN_TRACK");
    const value = parameterValueAt(this.#registry.get(view.instrument), parameter, fraction);
    if (value === null) return fail("UNKNOWN_PARAMETER");
    const result = this.setParam(track, parameter, value);
    return result.ok ? { ok: true, value } : result;
  }

  /** The fader's arrows: `steps` of 0.5 dB from the gain sounding now. */
  nudgeGain(track: string, steps: number): ValueCommandResult {
    const gain = this.#track(track)?.parameters.find((parameter) => parameter.name === "gain");
    if (gain === undefined) return fail("UNKNOWN_TRACK");
    // A signal on gain is replaced by a fixed value from the middle of its band.
    const signal = gain.signal;
    const current = gain.value ?? (signal === null ? 1 : signal.from + ((signal.to - signal.from) * (signal.low + signal.high)) / 2);
    const value = stepGain(current, steps);
    const result = this.setParam(track, "gain", value);
    return result.ok ? { ok: true, value } : result;
  }

  /** Double tap or double click on the fader: 0 dB, `gain 1`. */
  resetGain(track: string): CommandResult {
    return this.setParam(track, "gain", 1);
  }

  /**
   * `bar` and `step` index TrackView.bars. A rest of a pitched track takes the bar's
   * first note, or the tonic in octave 2; a drum rest becomes "x".
   */
  toggleStep(track: string, bar: number, step: number): CommandResult {
    const view = this.#track(track);
    const cell = view?.bars[bar]?.[step];
    if (view === undefined) return fail("UNKNOWN_TRACK");
    if (cell === undefined) return fail("UNKNOWN_STEP");
    const pitchedRest = cell.kind === "rest" && this.#isPitched(view.instrument);
    const note = pitchedRest ? this.#defaultNote(view.bars[bar] ?? []) : undefined;
    return this.#edit((source) => this.#editor.toggleStep(source, track, bar, step, note), on("step", track));
  }

  /**
   * The note picker: a note in any octave, a chord of any
   * quality, a hold that lengthens the note before it, or a rest, on one step.
   */
  setStepPitch(track: string, bar: number, step: number, pitch: StepPitch): CommandResult {
    const view = this.#track(track);
    if (view === undefined) return fail("UNKNOWN_TRACK");
    if (view.bars[bar]?.[step] === undefined) return fail("UNKNOWN_STEP");
    return this.#edit((source) => this.#editor.setStepPitch(source, track, bar, step, pitch), on("note", track));
  }

  /** Scale lock: on, the track's notes move to the key; off writes `free`. */
  setScaleLock(track: string, isLocked: boolean): CommandResult {
    if (this.#track(track) === undefined) return fail("UNKNOWN_TRACK");
    return this.#edit((source) => this.#editor.setTrackFree(source, track, !isLocked), on("scale lock", track));
  }

  /** Loop mode: how many bars one pass lasts, 1..16; enters on the next bar. */
  setLoopBars(bars: number): CommandResult {
    if (this.#session.state().program === null) return fail("NO_PROGRAM");
    return this.#edit((source) => this.#editor.setLoopBars(source, bars), on("loop length", null));
  }

  /**
   * 1..16 bars for a track's pattern. A written loop shorter than the pattern grows with
   * it in the same edit (one undo step), so the new bars are heard.
   */
  setTrackBars(track: string, bars: number): CommandResult {
    if (this.#track(track) === undefined) return fail("UNKNOWN_TRACK");
    if (!Number.isInteger(bars) || bars < 1 || bars > MAX_TRACK_BARS) return fail("INVALID_VALUE");
    const loopBars = this.#session.state().program?.loopBars ?? null;
    return this.#edit((source) => {
      const edit = this.#editor.setTrackBars(source, track, bars);
      if (!edit.ok || loopBars === null || loopBars >= bars) return edit;
      return this.#editor.setLoopBars(edit.source, bars);
    }, on("bars", track));
  }

  /** 8, 16 or 32 steps in every bar of the track; notes of pitched tracks keep their length. */
  setStepCount(track: string, count: number): CommandResult {
    const view = this.#track(track);
    if (view === undefined) return fail("UNKNOWN_TRACK");
    if (!STEP_COUNTS.some((allowed) => allowed === count)) return fail("INVALID_VALUE");
    const hold = this.#isPitched(view.instrument);
    return this.#edit((source) => this.#editor.setStepCount(source, track, count, hold), on("steps", track));
  }

  /** Copy bar: the elements of the bar as written now; the caller keeps them for Paste here. */
  readBar(track: string, bar: number): string | null {
    if (this.#track(track) === undefined) return null;
    return this.#editor.readBar(this.#session.state().source, track, bar);
  }

  /** Paste here: the bar takes the copied elements, in one edit. */
  pasteBar(track: string, bar: number, text: string): CommandResult {
    if (this.#track(track) === undefined) return fail("UNKNOWN_TRACK");
    return this.#edit((source) => this.#editor.replaceBar(source, track, bar, text), on("paste", track));
  }

  /** Clear bar: every step a rest; a pitched track gets one "." per step for its notes. */
  clearBar(track: string, bar: number): CommandResult {
    const view = this.#track(track);
    if (view === undefined) return fail("UNKNOWN_TRACK");
    const separate = this.#isPitched(view.instrument);
    return this.#edit((source) => this.#editor.clearBar(source, track, bar, separate), on("clear bar", track));
  }

  /**
   * `sound` null is the default sound (no word in the text); `pattern` null the manifest's
   * first. The pattern enters in the music's key (patternInKey).
   */
  addTrack(instrument: string, sound: string | null = null, pattern: string | null = null): NamedCommandResult {
    const key = this.#session.view().key;
    return this.#namedEdit((source) => this.#editor.addTrack(source, instrument, sound, pattern, key), on("add", instrument));
  }

  duplicateTrack(track: string): NamedCommandResult {
    return this.#namedEdit((source) => this.#editor.duplicateTrack(source, track), on("duplicate", track));
  }

  /** Every section that names it follows, in one edit; a soloed track stays soloed. */
  renameTrack(track: string, newName: string): CommandResult {
    return this.#edit((source) => this.#editor.renameTrack(source, track, newName), {
      label: { what: "rename", target: newName },
      renamed: { from: track, to: newName },
    });
  }

  /**
   * Use Tone: removes the written parameters that override tone, so
   * tone shapes the sound again. Returns their names for the toast; empty when none.
   */
  useTone(track: string): { readonly ok: true; readonly removed: readonly string[] } | { readonly ok: false; readonly code: CommandFailure } {
    const view = this.#track(track);
    const manifest = view === undefined ? undefined : this.#registry.get(view.instrument);
    if (view === undefined || manifest === undefined) return fail("UNKNOWN_TRACK");
    const removed = toneOverridesOf(view, manifest).map((entry) => entry.parameter);
    if (removed.length === 0) return { ok: true, removed };
    const result = this.#edit((source) => this.#editor.removeTrackParameters(source, track, removed), on("tone", track));
    return result.ok ? { ok: true, removed } : result;
  }

  deleteTrack(track: string): CommandResult {
    return this.#edit((source) => this.#editor.deleteTrack(source, track), on("delete", track));
  }

  setSectionMembership(section: string, track: string, member: boolean): CommandResult {
    return this.#edit((source) => this.#editor.setSectionMembership(source, section, track, member), on("tracks", section));
  }

  #track(name: string): TrackView | undefined {
    return this.#session.view().tracks.find((track) => track.name === name);
  }

  #isPitched(instrument: string): boolean {
    return this.#registry.get(instrument)?.kind !== "drum";
  }

  /** The bar's first note keeps the line's register; otherwise the tonic in octave 2. */
  #defaultNote(cells: readonly StepView[]): string {
    const midi = firstNote(cells);
    const name = midi === null ? null : midiToNoteName(midi);
    if (name !== null) return name;
    const tonic = this.#session.view().key?.tonic ?? 0;
    return `${pitchClassName(tonic)}${DEFAULT_NOTE_OCTAVE}`;
  }

  #edit(apply: (source: string) => SourceEdit, options: EditOptions): CommandResult {
    const result = this.#namedEdit((source) => {
      const edit = apply(source);
      return edit.ok ? { ...edit, name: "" } : edit;
    }, options);
    return result.ok ? OK : result;
  }

  /** Runs one edit on the current text and applies the result like typing. */
  #namedEdit(apply: (source: string) => NamedSourceEdit, options: EditOptions): NamedCommandResult {
    const result = apply(this.#session.state().source);
    if (!result.ok) return fail(result.reason);
    this.#session.applyText(result.source, options);
    return { ok: true, name: result.name };
  }
}

/** The history label of a gesture: what it changed, on which track or part. */
function on(what: string, target: string | null): EditOptions {
  return { label: { what, target } };
}

function firstNote(cells: readonly StepView[]): number | null {
  for (const cell of cells) if (cell.kind === "note") return cell.midi;
  return null;
}
