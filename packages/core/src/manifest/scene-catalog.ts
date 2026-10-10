// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The scene families, their shapes and drives: the vocabulary of a manifest's `scene`
// field. Data only; manifest-scene.ts reads the field, @untzel/scene adds
// where each family sits on the stage.

/** Every family and the shapes it accepts. */
export const SCENE_SHAPES = {
  shockwave: ["triple", "dome", "chime", "blast"],
  sparks: ["needle", "orbit", "grain"],
  burst: ["arcs", "shards", "halo"],
  mark: ["dash-pair", "square", "diamond", "ping"],
  ripple: ["triple", "twin", "core", "falling"],
  floor: ["band", "glow", "rolling", "comb"],
  ribbon: ["single", "squelch", "twin", "stepped", "fan", "band"],
  bars: ["keyboard", "tine", "drawbar", "string", "arc", "hanging", "marimba"],
  fog: ["cloud", "veil", "panel"],
  halo: ["arc", "aura"],
  sweep: ["band", "converge", "fall", "diagonal"],
} as const;
export type SceneFamily = keyof typeof SCENE_SHAPES;
export type SceneShape = (typeof SCENE_SHAPES)[SceneFamily][number];
export const SCENE_FAMILIES = Object.keys(SCENE_SHAPES) as readonly SceneFamily[];
export const SCENE_DRIVES = ["attack", "envelope", "pitch", "cutoff", "velocity"] as const;
export type SceneDrive = (typeof SCENE_DRIVES)[number];
export const SCENE_TINTS = ["track", "track-white-core"] as const;
export type SceneTint = (typeof SCENE_TINTS)[number];
export type SceneDensity = 1 | 2 | 3;

export interface SceneVariant {
  readonly shape: SceneShape;
  readonly density: SceneDensity;
  readonly tint: SceneTint;
}
/** The manifest's `scene`, normalised in its own JSON shape so a parsed manifest parses again. */
export interface SceneSpec {
  readonly family: SceneFamily;
  readonly variant: SceneVariant;
  readonly drive: SceneDrive;
}

export function isSceneFamily(value: unknown): value is SceneFamily {
  return typeof value === "string" && Object.hasOwn(SCENE_SHAPES, value);
}

export function isShapeOf(family: SceneFamily, shape: unknown): shape is SceneShape {
  return typeof shape === "string" && (SCENE_SHAPES[family] as readonly string[]).includes(shape);
}
