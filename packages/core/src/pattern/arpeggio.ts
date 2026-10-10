// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ArpMode, Voicing } from "./pattern-spec";
import { fnv1a32, mix, mulberry32 } from "./random";

// Chord voicings and the arpeggiator. Fixed order: chord → voicing → inversion → transpose → key lock → arp.

const OCTAVE = 12;

function ascending(midis: readonly number[]): number[] {
  return [...midis].sort((a, b) => a - b);
}

/**
 * Voices a chord written in close root position (lowest first). `open` raises the
 * second note an octave; `drop2` lowers the second-highest an octave; `spread` raises
 * every other note above the root an octave (two octaves from the root).
 */
export function voiceChord(midis: readonly number[], voicing: Voicing | null): readonly number[] {
  const notes = ascending(midis);
  if (notes.length < 2 || voicing === null || voicing === "close") return notes;
  switch (voicing) {
    case "open":
      return ascending(notes.map((midi, index) => (index === 1 ? midi + OCTAVE : midi)));
    case "drop2":
      return ascending(notes.map((midi, index) => (index === notes.length - 2 ? midi - OCTAVE : midi)));
    case "spread":
      return ascending(notes.map((midi, index) => (index % 2 === 1 ? midi + OCTAVE : midi)));
  }
}

/** Raises the `count` lowest notes an octave (after the voicing). */
export function invertChord(midis: readonly number[], count: number): readonly number[] {
  const notes = ascending(midis);
  const n = Math.max(0, Math.min(count, notes.length - 1));
  return ascending(notes.map((midi, index) => (index < n ? midi + OCTAVE : midi)));
}

/** The notes the arpeggiator walks: the played notes over `octaves` octaves. */
export function arpNotes(played: readonly number[], octaves: number, mode: ArpMode): readonly number[] {
  const base = mode === "played" ? [...played] : ascending(played);
  const extended: number[] = [];
  for (let octave = 0; octave < octaves; octave += 1) {
    for (const midi of base) {
      const value = midi + OCTAVE * octave;
      if (value <= 127) extended.push(value);
    }
  }
  if (mode === "down") return extended.reverse();
  if (mode === "updown" && extended.length > 2) return [...extended, ...extended.slice(1, -1).reverse()];
  return extended;
}

/** Note of arpeggio step `step` for every mode but `random`. */
export function arpStepNote(notes: readonly number[], step: number): number {
  return notes[step % Math.max(1, notes.length)] ?? 0;
}

/** `random`: mulberry32(mix(sourceHash, fnv1a32(track + "#arp"), barIndex, step)). */
export function randomArpNote(
  notes: readonly number[],
  sourceHash: number,
  trackName: string,
  barIndex: number,
  step: number,
): number {
  const u = mulberry32(mix(sourceHash, fnv1a32(`${trackName}#arp`), barIndex, step))();
  return notes[Math.min(notes.length - 1, Math.floor(u * notes.length))] ?? 0;
}
