// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The track detail's presentation decisions that need core: the view itself
// reads core types only. Pure, tested in Node.
import { tonicToPitchClass } from "@untzel/core";
/** The key's pitch classes for the note picker, from the scale's spelled notes ("c", "eb"). */
export function scalePitchClassesOf(notes: readonly string[]): number[] {
  return notes.map(tonicToPitchClass).filter((pitchClass): pitchClass is number => pitchClass !== null);
}
