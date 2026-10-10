// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, fade, figure, withinBand, type Pulse } from "./family-context";
// burst: the core's broken figures. shards (snare) are 8 radial strokes in their band; arcs
// (clap) a ring cut into 5 arcs, turning a little with every hit; halo (crash) 12 fine
// arcs with a slow decay.

export function burstLife(shape: string, tone: number): number {
  return { arcs: 0.4 + tone * 0.3, shards: 0.32 + tone * 0.25, halo: 1.6 }[shape] ?? 0.5;
}

export function burstPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const band = anchor.band ?? { from: 0.3, to: 0.5 };
  const span = band.to - band.from;
  const rotation = anchor.rotation + cue.tick * 0.11 + cue.bar * 0.37;
  const at = { x: anchor.x, y: anchor.y };
  if (description.shape === "shards") {
    const size = band.from + span * (0.55 + 0.45 * pulse.grow);
    return [
      withinBand(figure(pulse, FigureKind.Shards, { ...at, size, width: 0.009 * (1 - pulse.t * 0.6), aspect: band.from / size, extra: 8, rotation, intensity: cue.velocity * fade(pulse, 2) }), anchor),
      area(pulse, AreaKind.Glow, { ...at, size: band.to, width: 0.7, intensity: cue.velocity * 0.18 * pulse.ramp * fade(pulse, 2) }),
    ];
  }
  if (description.shape === "halo") {
    const size = band.from + span * (0.5 + 0.35 * pulse.grow);
    return [withinBand(figure(pulse, FigureKind.Arcs, { ...at, size, width: 0.007, extra: 12, rotation, intensity: cue.velocity * 0.8 * fade(pulse, 1.5) }), anchor)];
  }
  const size = band.from + span * (0.35 + 0.65 * pulse.grow);
  return [withinBand(figure(pulse, FigureKind.Arcs, { ...at, size, width: 0.016 * (1 - pulse.t * 0.6), extra: 5, rotation, intensity: cue.velocity * fade(pulse, 2) }), anchor)];
}
