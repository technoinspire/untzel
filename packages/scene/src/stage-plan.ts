// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { SCENE_FAMILIES, mix, mulberry32, type SceneFamily } from "@untzel/core";
import { SCENE_ZONES, type SceneZone } from "./scene-catalog";
// The production's stage: one draw per production header (tempo, key, swing,
// loop, song), so another production gets another stage and the same one always the same.
// Fixed draw order: arrangement, rotation phase, one scale per family, one start per zone.
//   planSeed = mix(stagePlanHash, 0, 0x5CE7, 0)

export const PLAN_SALT = 0x5ce7;
export const ARRANGEMENT_COUNT = 4;

export interface StagePlan {
  /** 0..3: bit 0 mirrors x, bit 1 moves the core off the centre. */
  readonly arrangement: number;
  readonly isMirrored: boolean;
  readonly isCoreOffset: boolean;
  /** Radians added to every track's rotation. */
  readonly rotationPhase: number;
  /** 0.85..1.15 per family. */
  readonly familyScale: Readonly<Record<SceneFamily, number>>;
  /** 0..1 per zone: which slot the first member takes. */
  readonly zoneStart: Readonly<Record<SceneZone, number>>;
}

export function stagePlan(stagePlanHash: number): StagePlan {
  const random = mulberry32(mix(stagePlanHash, 0, PLAN_SALT, 0));
  const arrangement = Math.floor(random() * ARRANGEMENT_COUNT);
  const rotationPhase = random() * Math.PI * 2;
  const familyScale = Object.fromEntries(SCENE_FAMILIES.map((family) => [family, 0.85 + 0.3 * random()])) as Record<SceneFamily, number>;
  const zoneStart = Object.fromEntries(SCENE_ZONES.map((zone) => [zone, random()])) as Record<SceneZone, number>;
  return {
    arrangement,
    isMirrored: (arrangement & 1) === 1,
    isCoreOffset: (arrangement & 2) === 2,
    rotationPhase,
    familyScale,
    zoneStart,
  };
}
