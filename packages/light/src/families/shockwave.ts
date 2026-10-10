// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, fade, figure, withinBand, type Pulse } from "./family-context";
import { GROUND_LIGHT_FLOOR } from "./floor";
// shockwave: rings that leave a point. triple (kick) from the core's inner band, with a soft
// core glow that breathes with the beat; dome (boom) rises from the ground as a half ring;
// chime (bell) is a fine ring on the wall at the note's height; blast (impact) is a slow
// thick ring in the core's outer band.

/** The kick's glow, in u: the core's radius, so the drop breathes on every beat. */
const CORE_GLOW_RADIUS = 0.7;
/** extra of a Ring: 1 draws only the upper half. */
export const UPPER_HALF = 1;

export function shockwaveLife(shape: string, tone: number): number {
  return { triple: 0.75 + tone * 0.35, dome: 1.2, chime: 1.4, blast: 1.8 }[shape] ?? 1;
}

export function shockwavePrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  switch (pulse.description.shape) {
    case "dome":
      return dome(pulse);
    case "chime":
      return chime(pulse);
    case "blast":
      return blast(pulse);
    default:
      return triple(pulse);
  }
}

function strength(pulse: Pulse): number {
  return pulse.cue.velocity * (pulse.cue.isAccent ? 1 : 0.9);
}

function triple(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue } = pulse;
  const band = anchor.band ?? { from: 0.06, to: 0.5 };
  const travel = (band.to - band.from) * (0.6 + 0.4 * pulse.tone) * Math.min(1, pulse.scale);
  const copies = pulse.isReduced ? [[0, 1, 1]] : [[0, 1, 1], [0.07, 0.5, 0.6], [0.14, 0.28, 0.35]];
  const rings = copies.flatMap(([lag = 0, weight = 1, thickness = 1]) => {
    if (pulse.age < lag) return [];
    const t = Math.min(1, (pulse.age - lag) / pulse.life);
    const grow = pulse.isReduced ? 0.5 : 1 - (1 - t) ** 3;
    const intensity = strength(pulse) * weight * (pulse.isReduced ? fade(pulse, 1) : (1 - t) ** 2);
    const ring = figure(pulse, FigureKind.Ring, { x: anchor.x, y: anchor.y, size: band.from + grow * travel, width: (0.014 + cue.tone * 0.008) * thickness * (1 - t * 0.5), intensity });
    return [withinBand(ring, anchor)];
  });
  const glow = area(pulse, AreaKind.Glow, {
    x: anchor.x,
    y: anchor.y,
    // The shockwave's body fills the whole core, under the other core figures.
    size: Math.max(band.to, CORE_GLOW_RADIUS * pulse.scale),
    width: 0.25,
    intensity: strength(pulse) * 0.5 * pulse.ramp * fade(pulse, 1.2),
  });
  return [...rings, glow];
}

function dome(pulse: Pulse): readonly ScenePrimitive[] {
  const radius = 0.12 + pulse.grow * 0.55 * pulse.scale;
  const intensity = strength(pulse) * 0.8 * fade(pulse, 1.5);
  return [
    figure(pulse, FigureKind.Ring, { x: pulse.anchor.x, y: pulse.anchor.y, size: radius, width: 0.024 * (1 - pulse.t * 0.5), intensity, extra: UPPER_HALF }),
    // Its fall below the line stops at the ground's floor, clear of every brand zone.
    area(pulse, AreaKind.Rise, { x: 0, y: pulse.anchor.y, size: radius * 0.6, width: 0, aspect: Math.max(0, GROUND_LIGHT_FLOOR - pulse.anchor.y), intensity: intensity * 0.35 * pulse.ramp }),
  ];
}

function chime(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor } = pulse;
  const y = anchor.y + (0.5 - pulse.pitch) * 2 * anchor.reachY * 0.7;
  const size = Math.min(anchor.reachX, anchor.reachY, 0.04 + pulse.grow * 0.14 * pulse.scale);
  const intensity = strength(pulse) * fade(pulse, 1.5);
  return [
    figure(pulse, FigureKind.Ring, { x: anchor.x, y, size, width: 0.009, intensity }),
    area(pulse, AreaKind.Glow, { x: anchor.x, y, size: size * 1.2, width: 0.5, intensity: intensity * 0.3 }),
  ];
}

function blast(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor } = pulse;
  const band = anchor.band ?? { from: 0.5, to: 0.76 };
  const size = band.from + pulse.grow * (band.to - band.from);
  const intensity = strength(pulse) * 0.7 * pulse.ramp * fade(pulse, 2);
  return [
    withinBand(figure(pulse, FigureKind.Ring, { x: anchor.x, y: anchor.y, size, width: 0.05 * (1 - pulse.t * 0.7), intensity }), anchor),
    area(pulse, AreaKind.Glow, { x: anchor.x, y: anchor.y, size, width: 0.5, intensity: intensity * 0.45 }),
  ];
}
