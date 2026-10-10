// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, type Pulse } from "./family-context";
// sweep: effects cross the field edge to edge. band (noise) a band at the cutoff's height;
// converge (riser) two bands meeting at the centre; fall (downlifter) a band falling over
// 4 s; diagonal (sweep) a tilted band. The travel stays between −0.70 and 0.48 u: under the
// top chrome and above every brand zone.

export const SWEEP_TOP = -0.7;
export const SWEEP_BOTTOM = 0.48;
const DIAGONAL_TOP = -0.25;
const HALF_HEIGHT = 0.07;

export function sweepLife(shape: string, cue: { readonly duration: number; readonly release: number }): number {
  if (shape === "fall") return 4;
  return Math.max(0.4, cue.duration + Math.min(cue.release, 2.5));
}

export function sweepPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { cue, description } = pulse;
  const intensity = cue.velocity * 0.55 * pulse.ramp * Math.max(pulse.level, 0.3 * (1 - pulse.t));
  const band = (y: number, rotation = 0, weight = 1) => area(pulse, AreaKind.Band, { x: 0, y, size: HALF_HEIGHT, rotation, intensity: intensity * weight });
  const between = (top: number, bottom: number, at: number) => top + (bottom - top) * Math.min(1, Math.max(0, at));
  switch (description.shape) {
    case "converge": {
      const travel = pulse.isReduced ? 0.5 : pulse.t;
      return [band(between(SWEEP_TOP, -0.02, travel)), band(between(SWEEP_BOTTOM, -0.02, travel))];
    }
    case "fall":
      return [band(between(SWEEP_TOP, SWEEP_BOTTOM, pulse.isReduced ? 0.5 : pulse.age / 4))];
    case "diagonal":
      return [band(between(SWEEP_BOTTOM, DIAGONAL_TOP, pulse.tone), -0.18 * description.mirror)];
    default:
      return [band(between(SWEEP_BOTTOM, SWEEP_TOP, pulse.tone))];
  }
}
