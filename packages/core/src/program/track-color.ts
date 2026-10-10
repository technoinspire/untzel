// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { fnv1a32 } from "../pattern/random";

// One identity per track, from its name, shared by the light layers (their hue), the
// code (gutter bar and name) and the track tiles (the dot).

/** Colors of the track palette (the values live in the editor and controls styles). */
export const TRACK_COLOR_COUNT = 8;

/** 0..1, stable for a name: the light layer's hue (0 = flare, 1 = ember). */
export function trackHue(name: string): number {
  return ((fnv1a32(name) >>> 8) % 1000) / 1000;
}

/** 0..TRACK_COLOR_COUNT-1: the same hue cut into the palette. */
export function trackColorIndex(name: string): number {
  return Math.min(TRACK_COLOR_COUNT - 1, Math.floor(trackHue(name) * TRACK_COLOR_COUNT));
}
