// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { chordNameToMidis, noteNameToMidi, type ChordQuality } from "./pitch";

// What one step of a melodic track plays (the note picker). The
// language writes it ("eb4", "Fm7", "~", "."); the controls choose it.

export type StepPitch =
  /** A note word with its octave, for example "eb4". */
  | { readonly kind: "note"; readonly note: string }
  /** A chord: root letter with its accidental ("F", "Bb") and quality. */
  | { readonly kind: "chord"; readonly root: string; readonly quality: ChordQuality }
  /** Holds the previous note one more step: this is how a note gets longer. */
  | { readonly kind: "hold" }
  | { readonly kind: "rest" };

export const CHORD_QUALITIES: readonly ChordQuality[] = ["major", "m", "7", "m7", "maj7", "sus2", "sus4", "dim"];

/** "F" for a major chord, "Fm7" otherwise: the chord word the language writes. */
export function chordWord(root: string, quality: ChordQuality): string {
  return `${root}${quality === "major" ? "" : quality}`;
}

/**
 * Every key a pitch sounds, lowest first: one for a note, the engine's voicing for a
 * chord (chordNameToMidis), none for a hold or a rest. The note picker presses these
 * keys and a touched step auditions them.
 */
export function stepPitchMidis(pitch: StepPitch): readonly number[] {
  if (pitch.kind === "note") {
    const midi = noteNameToMidi(pitch.note);
    return midi === null ? [] : [midi];
  }
  if (pitch.kind === "chord") return chordNameToMidis(chordWord(pitch.root, pitch.quality)) ?? [];
  return [];
}
