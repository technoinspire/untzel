// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { MAX_AREAS, MAX_PRIMITIVES, type ScenePrimitive } from "../composer/scene-primitive";
import type { StageMask } from "./renderer";
// The GPU layout of a frame, shared by the shaders: three vec4 per primitive,
//   (kind, x, y, size) (width, intensity, color, extra) (whiteCore, aspect, rotation, flow)
// plus the look seed, which the noise reads as an integer.

export const FLOATS_PER_FIGURE = 13;
export const VEC4_PER_AREA = 4;
export const MAX_MASK_BOXES = 4;

export function packFigures(primitives: readonly ScenePrimitive[], target: Float32Array): number {
  let count = 0;
  for (const primitive of primitives) {
    if (primitive.layer !== "figure" || count >= MAX_PRIMITIVES) continue;
    target.set(fields(primitive), count * FLOATS_PER_FIGURE);
    count += 1;
  }
  return count;
}

export function packAreas(primitives: readonly ScenePrimitive[], target: Float32Array): number {
  let count = 0;
  for (const primitive of primitives) {
    if (primitive.layer !== "area" || count >= MAX_AREAS) continue;
    target.set(fields(primitive), count * VEC4_PER_AREA * 4);
    count += 1;
  }
  return count;
}

function fields(primitive: ScenePrimitive): readonly number[] {
  return [
    primitive.kind,
    primitive.x,
    primitive.y,
    primitive.size,
    primitive.width,
    primitive.intensity,
    primitive.color,
    primitive.extra,
    primitive.whiteCore ? 1 : 0,
    primitive.aspect,
    primitive.rotation,
    primitive.flow,
    // The seed's low 16 bits: exact in a float, enough to set the noise apart per track.
    primitive.seed & 0xffff,
  ];
}

/** Without a top mask the line sits this far above any frame (stage-height units). */
const NO_TOP_MASK_Y = -1e4;
/** The mask as vec4 boxes (minX, minY, maxX, maxY) and (topY, feather, count, 0). */
export function packMask(mask: StageMask, target: Float32Array): void {
  target.fill(0);
  mask.boxes.slice(0, MAX_MASK_BOXES).forEach((box, index) => target.set([box.minX, box.minY, box.maxX, box.maxY], index * 4));
  target.set([mask.topY ?? NO_TOP_MASK_Y, mask.feather, Math.min(mask.boxes.length, MAX_MASK_BOXES), 0], MAX_MASK_BOXES * 4);
}
