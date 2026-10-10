// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fnv1a32, mix } from "@untzel/core";
import { MAX_SECTION_SHIFT_DEGREES } from "./palette";
// The section's turn of the whole palette:
//   (mix(lightSourceHash, fnv1a32(sectionName), 0x5EC7, 0) mod 25) − 12 degrees

export const SECTION_SALT = 0x5ec7;

/** −12..12 degrees, the same for every track of a section; 0 without a section. */
export function sectionHueShift(lightSourceHash: number, sectionName: string | null): number {
  if (sectionName === null) return 0;
  const span = 2 * MAX_SECTION_SHIFT_DEGREES + 1;
  return (mix(lightSourceHash, fnv1a32(sectionName), SECTION_SALT, 0) % span) - MAX_SECTION_SHIFT_DEGREES;
}
