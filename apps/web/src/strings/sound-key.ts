// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How the catalog of descriptions names a sound: "piano/felt" (instruments.ts).

/** The key of a sound's description: "piano/felt". */
export function soundKey(instrument: string, sound: string): string {
  return `${instrument}/${sound}`;
}
