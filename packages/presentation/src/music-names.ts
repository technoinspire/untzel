// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How the screens spell a note and a key. A leaf: every presenter may import it. Pure.
import { midiToNoteName, pitchClassName, type Key } from "@untzel/core";
/** MIDI with c4 = 60: 24 → "c1", 39 → "eb2"; below c0 only the pitch class. */
export function midiName(midi: number): string {
  return midiToNoteName(midi) ?? pitchClassName(midi);
}
export function keyLabel(key: Key | null): string {
  return key === null ? "c minor" : `${pitchClassName(key.tonic)} ${key.scale}`;
}
