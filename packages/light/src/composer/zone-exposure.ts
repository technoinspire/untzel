// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneZone } from "@untzel/scene";
import { MAX_AREAS, type Area, type ScenePrimitive } from "./scene-primitive";
// Exposure: a zone with n full layers lights each at min(1, 1.5 / √n), so a busy
// zone does not burn to white; a change of n slides over 0.35 s. The area light of a zone
// sums to at most 1, and the frame keeps at most 64 area primitives, the strongest.

export const EXPOSURE_SLIDE_S = 0.35;

export function zoneScale(fullLayers: number): number {
  return fullLayers <= 0 ? 1 : Math.min(1, 1.5 / Math.sqrt(fullLayers));
}

/** From the bar before's scale to this bar's, over EXPOSURE_SLIDE_S after the bar starts. */
export function zoneScaleAt(previous: number, current: number, sinceBarStart: number): number {
  const t = Math.min(1, Math.max(0, sinceBarStart / EXPOSURE_SLIDE_S));
  return previous + (current - previous) * t;
}

export function countByZone(zones: Iterable<SceneZone>): ReadonlyMap<SceneZone, number> {
  const counts = new Map<SceneZone, number>();
  for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1);
  return counts;
}

/** Σ intensity of the area primitives of each zone held to 1, then the 64 strongest kept. */
export function capAreas(primitives: readonly ScenePrimitive[]): readonly ScenePrimitive[] {
  const sums = new Map<SceneZone, number>();
  for (const primitive of primitives) if (primitive.layer === "area") sums.set(primitive.zone, (sums.get(primitive.zone) ?? 0) + primitive.intensity);
  const scaled = primitives.map((primitive) => {
    const sum = sums.get(primitive.zone) ?? 0;
    return primitive.layer === "area" && sum > 1 ? { ...primitive, intensity: primitive.intensity / sum } : primitive;
  });
  const areas = scaled.filter((primitive): primitive is Area => primitive.layer === "area");
  if (areas.length <= MAX_AREAS) return scaled;
  const kept = new Set([...areas].sort((a, b) => b.intensity - a.intensity || a.seed - b.seed).slice(0, MAX_AREAS));
  return scaled.filter((primitive) => primitive.layer === "figure" || kept.has(primitive));
}

/** Reduced motion: coincident pulses of one track merge into the strongest. */
export function mergeCoincident<T extends { readonly audioTime: number; readonly velocity: number }>(cues: readonly T[]): readonly T[] {
  const byTime = new Map<number, T>();
  for (const cue of cues) {
    const held = byTime.get(cue.audioTime);
    if (held === undefined || cue.velocity > held.velocity) byTime.set(cue.audioTime, cue);
  }
  return [...byTime.values()];
}
