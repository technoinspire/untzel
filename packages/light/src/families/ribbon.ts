// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, LineShape, type ScenePrimitive } from "../composer/scene-primitive";
import { area, figure, type Pulse } from "./family-context";
// ribbon: leads across the horizon, edge to edge. The curve is 72 % the shape's own and
// 28 % flow noise (the GLSL adds it), inside ±amplitude; the cutoff sets the amplitude.
// single (lead), squelch (acid, a saw), twin (fm-lead), stepped (square), fan (supersaw,
// five fine ribbons), band (brass, a thick ribbon that swells).

/** The light a ribbon spreads over the horizon, in u. */
const HAZE_HALF_HEIGHT = 0.28;

export function ribbonLife(cue: { readonly duration: number; readonly release: number }): number {
  return Math.max(0.25, cue.duration + Math.min(cue.release, 2.5));
}

export function ribbonPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const lane = anchor.lane ?? { from: anchor.y - 0.05, to: anchor.y + 0.05 };
  const amplitude = (lane.to - lane.from) * 0.42 * (0.35 + 0.65 * pulse.tone) * Math.min(1, pulse.scale);
  const intensity = cue.velocity * (cue.isAccent ? 1 : 0.8) * Math.max(pulse.level, 0.25 * (1 - pulse.t));
  const phase = pulse.beat * 0.6 + description.phase * Math.PI * 2;
  const line = (shape: LineShape, y: number, size: number, width: number, shift: number, weight: number): ScenePrimitive =>
    figure(pulse, FigureKind.Line, { x: 0, y, size, width, extra: shape, rotation: phase + shift, aspect: 1 + description.phase, intensity: intensity * weight });
  // The haze lights more than a quarter of the square: it rises over LARGE_AREA_ATTACK_S
  // (families.test.ts found it switching on at once).
  const haze = area(pulse, AreaKind.Band, { x: 0, y: anchor.y, size: HAZE_HALF_HEIGHT + amplitude, intensity: intensity * 0.3 * pulse.ramp });
  switch (description.shape) {
    case "squelch":
      return [line(LineShape.Saw, anchor.y, amplitude, 0.008, 0, 1), haze];
    case "twin":
      return [line(LineShape.Ribbon, anchor.y, amplitude, 0.006, 0, 1), line(LineShape.Ribbon, anchor.y, amplitude, 0.006, Math.PI, 0.8), haze];
    case "stepped":
      return [line(LineShape.Steps, anchor.y, amplitude, 0.008, 0, 1), haze];
    case "fan":
      return [-2, -1, 0, 1, 2].map((index) => line(LineShape.Ribbon, anchor.y + index * amplitude * 0.18, amplitude * (1 - Math.abs(index) * 0.15), 0.004, index * 0.5, 1 - Math.abs(index) * 0.15)).concat(haze);
    case "band":
      return [line(LineShape.Ribbon, anchor.y, amplitude * 0.6, 0.012 + 0.03 * pulse.level, 0, 0.9), haze];
    default:
      return [line(LineShape.Ribbon, anchor.y, amplitude, 0.008, 0, 1), haze];
  }
}
