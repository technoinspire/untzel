// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type ScaleName = "minor" | "major" | "dorian" | "phrygian" | "chromatic";
export const SCALE_NAMES: readonly ScaleName[] = [
  "minor",
  "major",
  "dorian",
  "phrygian",
  "chromatic",
];
export interface Key {
  /** Pitch class 0..11, c = 0. */
  readonly tonic: number;
  readonly scale: ScaleName;
}
export type ChordQuality =
  | "major"
  | "m"
  | "7"
  | "m7"
  | "maj7"
  | "sus2"
  | "sus4"
  | "dim"
  | "6"
  | "m6"
  | "9"
  | "m9"
  | "maj9"
  | "add9"
  | "madd9"
  | "aug"
  | "dim7"
  | "m7b5"
  | "7sus4"
  | "11"
  | "m11"
  | "13";

const LETTER_PITCH_CLASS: Readonly<Record<string, number>> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

/** Semitones above the tonic of every degree. */
const SCALE_DEGREES: Readonly<Record<ScaleName, readonly number[]>> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Semitones above the root, root position, close voicing. */
const CHORD_INTERVALS: Readonly<Record<ChordQuality, readonly number[]>> = {
  major: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "9": [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  aug: [0, 4, 8],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  "7sus4": [0, 5, 7, 10],
  "11": [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  "13": [0, 4, 7, 10, 14, 21],
};
/** Every chord quality the language reads, as values so the docs can list them; "major" is written without a suffix. */
export const CHORD_QUALITY_NAMES = Object.keys(CHORD_INTERVALS) as readonly ChordQuality[];

/** Chord roots sit in octave 3: C3 = 48 up to B3 = 59 (Cb wraps to B3). */
const CHORD_ROOT_OCTAVE_START = 48;
const MIDI_MAX = 127;
const NOTE = /^([a-g])([b#]?)(\d)$/;
const TONIC = /^([a-g])([b#]?)$/;
const CHORD =
  /^([A-G])([b#]?)(maj7|m7|m|7|sus2|sus4|dim|6|m6|9|m9|maj9|add9|madd9|aug|dim7|m7b5|7sus4|11|m11|13)?$/;

function accidentalOffset(accidental: string): number {
  if (accidental === "#") return 1;
  return accidental === "b" ? -1 : 0;
}

function pitchClassOf(letter: string, accidental: string): number {
  return (LETTER_PITCH_CLASS[letter] ?? 0) + accidentalOffset(accidental);
}

function modulo12(value: number): number {
  return ((value % 12) + 12) % 12;
}

/** "c4" -> 60, "eb2" -> 39, "f#1" -> 30. Null when the text is not a note in 0..127. */
export function noteNameToMidi(text: string): number | null {
  const match = NOTE.exec(text);
  if (match === null) return null;
  const [, letter = "", accidental = "", octave = ""] = match;
  const midi = 12 * (Number(octave) + 1) + pitchClassOf(letter, accidental);
  return midi >= 0 && midi <= MIDI_MAX ? midi : null;
}

/** How the text spells each pitch class: flats except for f# and c#. */
const PITCH_CLASS_NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"] as const;
/** The grammar's octave is one digit: c0 (12) up to g9 (127). */
const LOWEST_WRITABLE_MIDI = 12;

/** 0 -> "c", 3 -> "eb", 6 -> "f#"; any integer, taken modulo 12. */
export function pitchClassName(pitchClass: number): string {
  return PITCH_CLASS_NAMES[modulo12(Math.trunc(pitchClass))] ?? "c";
}

/** 24 -> "c1", 39 -> "eb2". Null when the text cannot write it (outside 12..127). */
export function midiToNoteName(midi: number): string | null {
  if (!Number.isInteger(midi) || midi < LOWEST_WRITABLE_MIDI || midi > MIDI_MAX) return null;
  return `${pitchClassName(midi)}${Math.floor(midi / 12) - 1}`;
}

/**
 * Signed semitones from c to `tonic`, in −6..+5: manifest previews and patterns are
 * written in c minor and move by this much to the music's tonic.
 */
export function transposeFromC(tonic: number): number {
  const pitchClass = modulo12(Math.trunc(tonic));
  return pitchClass > 5 ? pitchClass - 12 : pitchClass;
}

/** "c", "eb", "f#" -> pitch class 0..11. Null when the text is not a tonic. */
export function tonicToPitchClass(text: string): number | null {
  const match = TONIC.exec(text);
  if (match === null) return null;
  const [, letter = "", accidental = ""] = match;
  return modulo12(pitchClassOf(letter, accidental));
}

/**
 * "Cm7" -> midis of the voicing, lowest first. Null when the text is not a chord.
 * Voicing: root position, close, root in octave 3 (C3 = 48 .. B3 = 59).
 */
export function chordNameToMidis(text: string): readonly number[] | null {
  const match = CHORD.exec(text);
  if (match === null) return null;
  const [, letter = "", accidental = "", quality = "major"] = match;
  const root =
    CHORD_ROOT_OCTAVE_START + modulo12(pitchClassOf(letter.toLowerCase(), accidental));
  return CHORD_INTERVALS[quality as ChordQuality].map((interval) => root + interval);
}

/** Pitch classes 0..11 of the key's scale, from the tonic up. */
export function scalePitchClasses(key: Key): readonly number[] {
  return SCALE_DEGREES[key.scale].map((degree) => modulo12(key.tonic + degree));
}

/** Nearest degree of the scale; ties go down. Chromatic returns midi unchanged. */
export function quantizeToScale(midi: number, key: Key): number {
  const degrees = SCALE_DEGREES[key.scale];
  const inScale = (candidate: number): boolean =>
    degrees.includes(modulo12(candidate - key.tonic));
  for (let distance = 0; distance < 12; distance += 1) {
    if (inScale(midi - distance)) return midi - distance;
    if (inScale(midi + distance)) return midi + distance;
  }
  return midi;
}
