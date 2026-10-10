// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The playable pitch range of a pitched or chord instrument (manifest field `range`):
// the lowest and highest note a note picker offers. Drums and effects have none.

import { noteNameToMidi } from "./pitch";

export interface PitchRange {
  /** MIDI, c4 = 60. */
  readonly lowest: number;
  readonly highest: number;
}

/** At least two octaves, so a picker always has room to move. */
export const MIN_RANGE_SEMITONES = 24;

export interface RangeProblem {
  readonly path: string;
  readonly message: string;
}

export type RangeResult = { readonly range: PitchRange | null; readonly problems: readonly RangeProblem[] };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function noteField(fields: Readonly<Record<string, unknown>>, key: "lowest" | "highest", problems: RangeProblem[]): number | null {
  const raw = fields[key];
  // A parsed manifest holds MIDI numbers, and createRegistry parses again: both read.
  const isMidi = typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 127;
  const midi = isMidi ? raw : typeof raw === "string" ? noteNameToMidi(raw) : null;
  if (midi === null) problems.push({ path: `range.${key}`, message: "must be a note name, for example c2" });
  return midi;
}

/**
 * Reads `range` for an instrument of `kind`: required for pitched and chord instruments,
 * absent for drum ones; `{ lowest, highest }` as note names, at least two octaves apart.
 */
export function readPitchRange(raw: unknown, pitched: boolean): RangeResult {
  if (!pitched) {
    // null is how a parsed drum manifest says it.
    return raw === undefined || raw === null ? { range: null, problems: [] } : { range: null, problems: [{ path: "range", message: "only pitched and chord instruments have a range" }] };
  }
  if (!isRecord(raw)) return { range: null, problems: [{ path: "range", message: "must be { lowest, highest } for a pitched or chord instrument" }] };
  const problems: RangeProblem[] = [];
  const lowest = noteField(raw, "lowest", problems);
  const highest = noteField(raw, "highest", problems);
  if (lowest === null || highest === null) return { range: null, problems };
  if (highest - lowest < MIN_RANGE_SEMITONES) {
    return { range: null, problems: [{ path: "range", message: `must span at least ${MIN_RANGE_SEMITONES} semitones` }] };
  }
  return { range: { lowest, highest }, problems: [] };
}
