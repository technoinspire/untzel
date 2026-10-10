// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { noteNameToMidi } from "@untzel/core";
import { replaceFix } from "../diagnostics/fixes";
import type { DiagnosticFix } from "../diagnostics/diagnostics";
import type { Token } from "../highlight/outline";

// What a written note that is not one probably meant (the quick fix of
// INVALID_NOTE): the same note spelled the way the grammar reads it, or the
// nearest octave the MIDI range has.

const SPELLED = /^([A-Ga-g])([b#]?)[ \t]*(\d)$/;
const WRITTEN = /^([a-z])([b#]?)(\d)$/;
const LOWEST_OCTAVE = 0;
const HIGHEST_OCTAVE = 9;

/** "C2", "Eb2", "c 2" -> "c2", "eb2", "c2"; null when that is no note either. */
export function respelledNote(text: string): string | null {
  const match = SPELLED.exec(text);
  if (match === null) return null;
  const [, letter = "", accidental = "", octave = ""] = match;
  const note = `${letter.toLowerCase()}${accidental}${octave}`;
  return note !== text && noteNameToMidi(note) !== null ? note : null;
}

/** "h2" -> "b2": H is B in German notation. Null for any other letter. */
export function germanNote(text: string): string | null {
  const match = WRITTEN.exec(text);
  if (match?.[1] !== "h" || match[2] !== "") return null;
  const note = `b${match[3] ?? ""}`;
  return noteNameToMidi(note) === null ? null : note;
}

/** "b9" (above MIDI 127) -> "b8": the written letter in the nearest octave that exists. */
export function nearestOctave(text: string): string | null {
  const match = WRITTEN.exec(text);
  if (match === null || noteNameToMidi(text) !== null) return null;
  const [, letter = "", accidental = "", written = ""] = match;
  const octave = Number(written);
  for (let step = 1; step <= HIGHEST_OCTAVE; step += 1) {
    for (const candidate of [octave - step, octave + step]) {
      if (candidate < LOWEST_OCTAVE || candidate > HIGHEST_OCTAVE) continue;
      const note = `${letter}${accidental}${candidate}`;
      if (noteNameToMidi(note) !== null) return note;
    }
  }
  return null;
}

/** INVALID_NOTE's fix: German H is not safe (another notation), the octave clamp is. */
export function noteFix(token: Token): { readonly suggestion: string | null; readonly fix: DiagnosticFix | null } {
  const german = germanNote(token.text);
  if (german !== null) return { suggestion: german, fix: replaceFix(token, german, false) };
  return { suggestion: null, fix: replaceFix(token, nearestOctave(token.text)) };
}
