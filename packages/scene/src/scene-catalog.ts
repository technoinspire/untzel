// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneFamily, SceneShape } from "@untzel/core";
// Where each family sits in the composition square.
// The family decides the zone, with two exceptions written here: the boom's dome
// rises from the ground and the bell's chime rings on the wall, so neither fights the
// kick's rings in the core.

/** Painted back to front in this order. */
export const SCENE_ZONES = ["field", "ground", "wall", "horizon", "floor", "core", "orbit", "sky"] as const;
export type SceneZone = (typeof SCENE_ZONES)[number];

const FAMILY_ZONE: Readonly<Record<SceneFamily, SceneZone>> = {
  shockwave: "core",
  sparks: "sky",
  burst: "core",
  mark: "orbit",
  ripple: "floor",
  floor: "ground",
  ribbon: "horizon",
  bars: "wall",
  fog: "field",
  halo: "wall",
  sweep: "field",
};

const SHAPE_ZONE: Readonly<Record<string, SceneZone>> = {
  "shockwave/dome": "ground",
  "shockwave/chime": "wall",
};

export function zoneOf(family: SceneFamily, shape: SceneShape): SceneZone {
  return SHAPE_ZONE[`${family}/${shape}`] ?? FAMILY_ZONE[family];
}
