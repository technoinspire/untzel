// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { overlapsBox, type ExclusionBox } from "./keep-out";
// The floor's two wings, in screen coordinates (left, right), each cut back from every brand
// zone it meets. Of the four cuts the one that keeps the most area wins: against the 16:9
// corner mark that is the horizontal one, so the right wing stops short of it.

export const FLOOR_WING = { minX: 0.62, maxX: 0.98, minY: 0.5, maxY: 0.94 } as const;

export function floorWings(brandZones: readonly ExclusionBox[]): readonly [ExclusionBox, ExclusionBox] {
  const left: ExclusionBox = { minX: -FLOOR_WING.maxX, maxX: -FLOOR_WING.minX, minY: FLOOR_WING.minY, maxY: FLOOR_WING.maxY };
  const right: ExclusionBox = { ...FLOOR_WING };
  return [brandZones.reduce(cutAway, left), brandZones.reduce(cutAway, right)];
}

export function boxArea(box: ExclusionBox): number {
  return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
}

function cutAway(box: ExclusionBox, zone: ExclusionBox): ExclusionBox {
  if (!overlapsBox(box, zone)) return box;
  const options: ExclusionBox[] = [
    { ...box, maxX: Math.min(box.maxX, zone.minX) },
    { ...box, minX: Math.max(box.minX, zone.maxX) },
    { ...box, maxY: Math.min(box.maxY, zone.minY) },
    { ...box, minY: Math.max(box.minY, zone.maxY) },
  ].filter((option) => option.maxX > option.minX && option.maxY > option.minY);
  options.sort((a, b) => boxArea(b) - boxArea(a));
  return options[0] ?? { ...box, maxX: box.minX };
}
