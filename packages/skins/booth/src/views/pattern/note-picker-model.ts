// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  CHORD_QUALITIES,
  chordWord,
  midiToNoteName,
  noteNameToMidi,
  pitchClassName,
  stepPitchMidis,
  type ChordQuality,
  type PitchRange,
  type StepPitch,
} from "@untzel/core";
import type { StepView } from "@untzel/presentation/view-model";

// What the note picker shows: two octaves of keys inside the
// instrument's range; every key the step plays pressed (a chord at the octaves where the
// engine voices it, through core's stepPitchMidis, never a second voicing here), the
// chord's root marked; marks on the octave buttons when pressed keys fall outside the
// window; the notes of the key marked and the others dimmed while Scale lock is on.
// Pure, tested without the DOM; the view only draws it.

export const KEYS_SHOWN = 24;
const OCTAVE = 12;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
/** Where a step with no note nearby starts: the bass register, as toggleStep does. */
const DEFAULT_OCTAVE_MIDI = 36;
const SPOKEN_LETTERS: Readonly<Record<string, string>> = { b: "flat", "#": "sharp" };


export interface PickerKey {
  readonly midi: number;
  /** "eb4", the note word the text will get. */
  readonly name: string;
  /** "E flat 4, in chord": what a screen reader says. */
  readonly label: string;
  readonly isBlack: boolean;
  readonly isInScale: boolean;
  /** The step plays this key now (the text says so). */
  readonly isPressed: boolean;
  /** The root of the chord the step plays. */
  readonly isRoot: boolean;
  /** Chosen but not written yet: Choose or a second tap writes it. */
  readonly isPending: boolean;
  /** Out of the key while Scale lock is on: playable, but moved to the key. */
  readonly isDimmed: boolean;
  /** Black keys sit after this many white keys of the window. */
  readonly whiteBefore: number;
}

/** The note word of a key: 63 → "eb4". */
export function noteNameOf(midi: number): string {
  return midiToNoteName(midi) ?? pitchClassName(((midi % OCTAVE) + OCTAVE) % OCTAVE);
}

/** "eb4" → "E flat 4"; with `inChord`, "E flat 4, in chord". */
export function spokenNote(name: string, inChord: boolean): string {
  const match = /^([a-g])([b#]?)(\d?)$/.exec(name);
  if (match === null) return name;
  const [, letter = "", accidental = "", octave = ""] = match;
  const words = [letter.toUpperCase(), SPOKEN_LETTERS[accidental] ?? "", octave].filter((word) => word !== "");
  return `${words.join(" ")}${inChord ? ", in chord" : ""}`;
}

/** The C at or below `midi`. */
function octaveStart(midi: number): number {
  return midi - (((midi % OCTAVE) + OCTAVE) % OCTAVE);
}

/** The first and last window starts that keep the two octaves inside the range. */
function windowBounds(range: PitchRange): { readonly first: number; readonly last: number } {
  const first = octaveStart(range.lowest);
  return { first, last: Math.max(first, octaveStart(range.highest - KEYS_SHOWN + 1)) };
}

/** The window of two octaves that shows `midi`, kept inside the range. */
export function windowStartFor(midi: number, range: PitchRange): number {
  const { first, last } = windowBounds(range);
  return Math.min(last, Math.max(first, octaveStart(midi)));
}

/** Octave − (−1) and + (+1); null when the window would leave the range. */
export function shiftWindow(start: number, delta: -1 | 1, range: PitchRange): number | null {
  const { first, last } = windowBounds(range);
  const next = start + delta * OCTAVE;
  return next < first || next > last ? null : next;
}

/** A second tap on the pitch already chosen writes it; any other tap chooses and sounds it. */
export function pickOutcome(pending: StepPitch | null, pitch: StepPitch): "commit" | "audition" {
  return pending !== null && pitchLabel(pending) === pitchLabel(pitch) ? "commit" : "audition";
}

/** "eb4", "Fm7", "F" (major), "hold", "rest". */
export function pitchLabel(pitch: StepPitch): string {
  switch (pitch.kind) {
    case "note":
      return pitch.note;
    case "chord":
      return chordWord(pitch.root, pitch.quality);
    case "hold":
    case "rest":
      return pitch.kind;
  }
}

/** What the picker says the step is: "Cm7", "eb2", "Rest", "Hold". */
export function stepStateLabel(pitch: StepPitch): string {
  if (pitch.kind === "rest") return "Rest";
  if (pitch.kind === "hold") return "Hold";
  return pitchLabel(pitch);
}

/** Every key a pitch sounds: one for a note, the engine's voicing for a chord (core). */
export function soundingMidis(pitch: StepPitch): readonly number[] {
  return stepPitchMidis(pitch);
}

/** The chord's root key (its lowest sounding note, root position), or the note itself. */
export function rootMidi(pitch: StepPitch): number | null {
  return soundingMidis(pitch)[0] ?? null;
}

export interface KeyboardState {
  readonly start: number;
  readonly scale: readonly number[];
  readonly isScaleLocked: boolean;
  /** What the text plays on the step. */
  readonly sounding: StepPitch;
  /** The choice waiting for Choose, if any. */
  readonly pending: StepPitch | null;
}

export function pickerKeys(state: KeyboardState): readonly PickerKey[] {
  const pressed = new Set(soundingMidis(state.sounding));
  const root = state.sounding.kind === "chord" ? rootMidi(state.sounding) : null;
  const pending = new Set(state.pending === null ? [] : soundingMidis(state.pending));
  const inChord = state.sounding.kind === "chord";
  let whites = 0;
  return Array.from({ length: KEYS_SHOWN }, (_, index) => {
    const midi = state.start + index;
    const pitchClass = ((midi % OCTAVE) + OCTAVE) % OCTAVE;
    const isBlack = BLACK_PITCH_CLASSES.has(pitchClass);
    const isInScale = state.scale.includes(pitchClass);
    const isPressed = pressed.has(midi);
    const name = noteNameOf(midi);
    const key = {
      midi,
      name,
      label: spokenNote(name, isPressed && inChord),
      isBlack,
      isInScale,
      isPressed,
      isRoot: midi === root,
      isPending: pending.has(midi) && !isPressed,
      isDimmed: state.isScaleLocked && !isInScale,
      whiteBefore: whites,
    };
    if (!isBlack) whites += 1;
    return key;
  });
}

/** Pressed keys below or above the window: the octave buttons show that more is lit. */
export function pressedOutside(sounding: StepPitch, start: number): { readonly below: boolean; readonly above: boolean } {
  const midis = soundingMidis(sounding);
  return { below: midis.some((midi) => midi < start), above: midis.some((midi) => midi >= start + KEYS_SHOWN) };
}

const CHORD_TEXT = /^([A-G][b#]?)(maj7|m7|m|7|sus2|sus4|dim)?$/;

/** What the step plays now, read from its label ("eb2", "Cm7"). */
export function stepPitchOf(step: StepView): StepPitch {
  if (step.kind === "hold") return { kind: "hold" };
  if (step.kind === "note" && step.label !== null) return { kind: "note", note: step.label };
  const chord = step.kind === "chord" && step.label !== null ? CHORD_TEXT.exec(step.label) : null;
  if (chord?.[1] !== undefined) return { kind: "chord", root: chord[1], quality: (chord[2] ?? "major") as ChordQuality };
  return { kind: "rest" };
}

/** The chord root a key gives: "eb" → "Eb". */
export function chordRootOf(midi: number): string {
  const name = pitchClassName(((midi % OCTAVE) + OCTAVE) % OCTAVE);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The key a pitch centres the window on: the note, or the chord's root. */
export function midiOfPitch(pitch: StepPitch): number | null {
  return rootMidi(pitch);
}

/** The same note an octave down (−1) or up (+1); chords keep their octave in the text. */
export function octaveShifted(pitch: StepPitch | null, delta: -1 | 1): StepPitch | null {
  if (pitch?.kind !== "note") return null;
  const midi = noteNameToMidi(pitch.note);
  const name = midi === null ? null : midiToNoteName(midi + delta * OCTAVE);
  return name === null ? null : { kind: "note", note: name };
}

/**
 * The note a rest or hold opens on: the last note before the step in the bar, else
 * any note of the bar, else the tonic in the bass register.
 */
export function startingMidi(steps: readonly StepView[], index: number, tonic: number): number {
  const notes = steps.map((step) => midiOfPitch(stepPitchOf(step)));
  const before = notes.slice(0, index + 1).reverse().find((midi) => midi !== null);
  return before ?? notes.find((midi) => midi !== null) ?? DEFAULT_OCTAVE_MIDI + tonic;
}

export interface QualityChip {
  readonly quality: ChordQuality;
  readonly label: string;
  readonly isPressed: boolean;
}

export function qualityChips(root: string, quality: ChordQuality | null): readonly QualityChip[] {
  return CHORD_QUALITIES.map((entry) => ({
    quality: entry,
    label: pitchLabel({ kind: "chord", root, quality: entry }),
    isPressed: entry === quality,
  }));
}

/** Said when the chosen key is out of the key while Scale lock is on. */
export function scaleWarning(key: PickerKey | undefined, scaleLabel: string): string | null {
  if (key === undefined || !key.isDimmed) return null;
  return `${scaleLabel} moves this note to the scale; turn off Scale lock to play it`;
}
