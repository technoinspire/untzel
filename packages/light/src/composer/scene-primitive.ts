// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneZone } from "@untzel/scene";
// What every renderer draws. Figures are crisp shapes evaluated by a signed
// distance per instanced quad; areas are soft light summed by one full-screen pass. All
// lengths are in composition units (u) until placeOnStage maps them to the stage.

export enum FigureKind {
  Ring = 0,
  /** A ring cut into `extra` arcs. */
  Arcs = 1,
  /** `extra` radial strokes from `aspect` × size to size. */
  Shards = 2,
  /** A vertical stroke of length size. */
  Needle = 3,
  /** A filled dot of radius size. */
  Dot = 4,
  /** A square outline, half side size; rotation turns it (45° is the diamond). */
  Square = 5,
  /** Two short strokes side by side. */
  DashPair = 6,
  /** An ellipse outline: radius size across, size × aspect down. */
  Ellipse = 7,
  /** A rounded bar: half width size, half height size × aspect. */
  Bar = 8,
  /** Edge to edge: a glowing line y = shape(x), amplitude size. */
  Line = 9,
  /** Edge to edge: teeth of height size along a line. */
  Comb = 10,
}

/** The curve a Line draws across the width. */
export enum LineShape {
  Flat = 0,
  Wave = 1,
  Saw = 2,
  Steps = 3,
  /** Wave plus flow noise: the lead's ribbon. */
  Ribbon = 4,
}

export enum AreaKind {
  /** A soft disc, radius size, height size × aspect. */
  Glow = 0,
  /** Four flow-noise lobes around the anchor: the fog. */
  Cloud = 1,
  /** A soft horizontal band of half height size, across the width. */
  Band = 2,
  /** Light rising from a line at y towards the top, height size, across the width. */
  Rise = 3,
}

interface PrimitiveShared {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Stroke width (figures) or softness (areas). */
  readonly width: number;
  /** 0..1 before the limiter. */
  readonly intensity: number;
  /** 0..7, the track's palette slot. */
  readonly color: number;
  readonly whiteCore: boolean;
  readonly aspect: number;
  /** Radians. */
  readonly rotation: number;
  /** Kind-specific: arc count, line shape, phase. */
  readonly extra: number;
  /** Flow-noise time; 0 under reduced motion. */
  readonly flow: number;
  /** The track's look seed, for the noise's offset. */
  readonly seed: number;
  readonly zone: SceneZone;
  /** Cue peaks go through the flash limiter; the idle fog does not. */
  readonly isTransient: boolean;
}

export interface Figure extends PrimitiveShared {
  readonly layer: "figure";
  readonly kind: FigureKind;
}

export interface Area extends PrimitiveShared {
  readonly layer: "area";
  readonly kind: AreaKind;
}

export type ScenePrimitive = Figure | Area;

/** Most primitives of one frame. */
export const MAX_PRIMITIVES = 192;
/** Most area primitives the full-screen pass sums. */
export const MAX_AREAS = 64;

export function isEdgeToEdge(primitive: ScenePrimitive): boolean {
  if (primitive.layer === "figure") return primitive.kind === FigureKind.Line || primitive.kind === FigureKind.Comb;
  return primitive.kind === AreaKind.Band || primitive.kind === AreaKind.Rise;
}
