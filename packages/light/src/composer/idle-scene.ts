// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Composition } from "./composer";
import { AreaKind, type Area } from "./scene-primitive";
import { NO_SKY } from "./sky-atmosphere";
// The waiting screen: before the music, a slow fog in two palette colours drifting
// on the wall clock. Base light, never a peak: the limiter does not count it.

const FOG: Omit<Area, "x" | "y" | "flow"> = {
  layer: "area",
  kind: AreaKind.Cloud,
  size: 0.9,
  width: 0.4,
  intensity: 0.22,
  color: 0,
  whiteCore: false,
  aspect: 0.55,
  rotation: 0,
  extra: 0,
  seed: 0x1d1e,
  zone: "field",
  isTransient: false,
};

export function idleComposition(seconds: number, isReduced: boolean): Composition {
  const time = isReduced ? 0 : seconds;
  const drift = (period: number, phase: number): number => Math.sin((time / period) * Math.PI * 2 + phase);
  const primitives: Area[] = [
    { ...FOG, x: drift(23, 0) * 0.25, y: -0.1 + drift(31, 1) * 0.06, flow: time * 0.01 },
    { ...FOG, color: 6, size: 0.7, intensity: 0.12, x: drift(37, 2) * 0.4, y: 0.08 + drift(29, 3) * 0.06, flow: time * 0.008, seed: 0x2e2f },
  ];
  return { primitives, paletteShift: 0, coreX: 0, stagePlanHash: 0, lightTracks: [], sky: NO_SKY, flow: 0 };
}
