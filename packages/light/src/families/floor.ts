// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, LineShape, type ScenePrimitive } from "../composer/scene-primitive";
import { area, fade, figure, type Pulse } from "./family-context";
// floor: the bass lights the ground across the whole width. band (bass) a lit edge the
// cutoff lifts inside its lane, light rising from it; glow (sub) the light alone, soft;
// rolling (reese) two waves out of phase; comb (fm-bass) teeth the brightness raises.

/** The ground's light never reaches below this line, clear of every brand zone. */
export const GROUND_LIGHT_FLOOR = 0.55;
/** The ground keeps glowing this long after the note, so a bass line reads as one light. */
const GROUND_TAIL_S = 1.2;

export function floorLife(cue: { readonly duration: number; readonly release: number }): number {
  return Math.max(0.25, cue.duration + Math.min(cue.release, 2.5)) + GROUND_TAIL_S;
}

export function floorPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const lane = anchor.lane ?? { from: anchor.y - 0.05, to: anchor.y + 0.05 };
  const height = lane.to - lane.from;
  const y = lane.to - height * (0.15 + 0.7 * pulse.tone);
  const intensity = cue.velocity * Math.max(pulse.level, 0.6 * fade(pulse, 0.6));
  const rise = area(pulse, AreaKind.Rise, {
    x: 0,
    y,
    size: (0.5 + 0.35 * pulse.tone) * pulse.scale,
    aspect: Math.max(0, GROUND_LIGHT_FLOOR - y),
    intensity: intensity * (description.shape === "glow" ? 1 : 0.62),
  });
  const line = (shape: LineShape, size: number, extra: number, weight: number) =>
    figure(pulse, FigureKind.Line, { x: 0, y, size, width: 0.012, extra: shape, rotation: extra, intensity: intensity * weight });
  switch (description.shape) {
    case "glow":
      return [rise];
    case "rolling":
      return [line(LineShape.Wave, height * 0.3, pulse.beat * 0.5, 0.9), line(LineShape.Wave, height * 0.3, pulse.beat * 0.5 + Math.PI, 0.6), rise];
    case "comb":
      return [figure(pulse, FigureKind.Comb, { x: 0, y, size: (0.03 + 0.08 * pulse.tone) * pulse.scale, width: 0.008, intensity }), line(LineShape.Flat, 0, 0, 0.6), rise];
    default:
      return [line(LineShape.Flat, 0, 0, 1), rise];
  }
}
