// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneFamily } from "@untzel/core";
import type { SceneAnchor, SceneDescription } from "@untzel/scene";
import type { LightCue } from "../ports";
import type { ScenePrimitive } from "../composer/scene-primitive";
import { barsLife, barsPrimitives } from "./bars";
import { burstLife, burstPrimitives } from "./burst";
import { pulseAt, type Motion, type Pulse } from "./family-context";
import { floorLife, floorPrimitives } from "./floor";
import { fogLife, fogPrimitives } from "./fog";
import { haloLife, haloPrimitives } from "./halo";
import { lightVersion } from "./light-version";
import { markLife, markPrimitives } from "./mark";
import { ribbonLife, ribbonPrimitives } from "./ribbon";
import { rippleLife, ripplePrimitives } from "./ripple";
import { shockwaveLife, shockwavePrimitives } from "./shockwave";
import { sparksLife, sparksPrimitives } from "./sparks";
import { sweepLife, sweepPrimitives } from "./sweep";
// One entry per family: how long a pulse lives, what it draws, and how many
// primitives one pulse costs (the budget's analytic cost).

interface FamilyEntry {
  readonly life: (description: SceneDescription, cue: LightCue) => number;
  readonly draw: (pulse: Pulse) => readonly ScenePrimitive[];
  readonly perPulse: (description: SceneDescription) => number;
}

const FAMILIES: Readonly<Record<SceneFamily, FamilyEntry>> = {
  shockwave: { life: (d, cue) => shockwaveLife(d.shape, cue.tone), draw: shockwavePrimitives, perPulse: (d) => (d.shape === "triple" ? 4 : 2) },
  burst: { life: (d, cue) => burstLife(d.shape, cue.tone), draw: burstPrimitives, perPulse: (d) => (d.shape === "shards" ? 2 : 1) },
  sparks: { life: (d, cue) => sparksLife(d.shape, cue.tone), draw: sparksPrimitives, perPulse: (d) => 1 + (d.shape === "grain" ? 3 * d.density : d.shape === "orbit" ? 3 + d.density : 2 + 2 * d.density) },
  mark: { life: (d) => markLife(d.shape), draw: markPrimitives, perPulse: (d) => (d.shape === "ping" ? 2 : 1) },
  ripple: { life: (d, cue) => rippleLife(d.shape, cue.tone), draw: ripplePrimitives, perPulse: () => 4 },
  floor: { life: (_, cue) => floorLife(cue), draw: floorPrimitives, perPulse: () => 3 },
  ribbon: { life: (_, cue) => ribbonLife(cue), draw: ribbonPrimitives, perPulse: (d) => (d.shape === "fan" ? 6 : 3) },
  bars: { life: (_, cue) => barsLife(cue), draw: barsPrimitives, perPulse: () => 5 },
  fog: { life: (_, cue) => fogLife(cue), draw: fogPrimitives, perPulse: () => 2 },
  halo: { life: (_, cue) => haloLife(cue), draw: haloPrimitives, perPulse: () => 2 },
  sweep: { life: (d, cue) => sweepLife(d.shape, cue), draw: sweepPrimitives, perPulse: (d) => (d.shape === "converge" ? 2 : 1) },
};

/** Seconds a cue of this scene stays on screen (reduced motion adds its fall). */
export function lifeOf(description: SceneDescription, cue: LightCue): number {
  return FAMILIES[description.family].life(description, cue);
}

export function primitivesPerPulse(description: SceneDescription): number {
  return FAMILIES[description.family].perPulse(description);
}

/** What one cue draws at `now`, full or as the light version. */
export function cuePrimitives(
  description: SceneDescription,
  anchor: SceneAnchor,
  cue: LightCue,
  now: number,
  motion: Motion,
  version: { readonly isFull: boolean; readonly energy: number },
): readonly ScenePrimitive[] {
  const pulse = pulseAt(description, anchor, cue, now, lifeOf(description, cue), motion);
  if (pulse === null) return [];
  if (!version.isFull) return [lightVersion(pulse, version.energy)];
  return FAMILIES[description.family].draw(pulse).filter((primitive) => primitive.intensity > 0.003);
}
