// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { fade, figure, type Pulse } from "./family-context";
// mark: small exact figures on the orbit. dash-pair (rim), square (woodblock, at 0 rad),
// diamond (cowbell, at 45°), ping (perc: a full dot with a ring). At least 0.07 u, so a
// mark stays readable on the phone; the tune sets the size of the square and the diamond.

export function markLife(shape: string): number {
  return { "dash-pair": 0.28, square: 0.34, diamond: 0.42, ping: 0.5 }[shape] ?? 0.3;
}

export function markPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const grow = 1 + pulse.grow * 0.3;
  const fit = (size: number): number => Math.min(anchor.reachX, size * grow);
  const intensity = cue.velocity * fade(pulse, 1.6);
  const at = { x: anchor.x, y: anchor.y };
  switch (description.shape) {
    case "ping":
      return [
        figure(pulse, FigureKind.Dot, { ...at, size: fit(0.035), intensity }),
        figure(pulse, FigureKind.Ring, { ...at, size: fit(0.035 + pulse.grow * 0.06), width: 0.006, intensity: intensity * 0.7 }),
      ];
    case "square":
      return [figure(pulse, FigureKind.Square, { ...at, size: fit(0.035 + 0.015 * pulse.pitch), width: 0.008, intensity })];
    case "diamond":
      return [figure(pulse, FigureKind.Square, { ...at, size: fit(0.0375 + 0.015 * pulse.pitch), width: 0.008, rotation: Math.PI / 4, intensity })];
    default:
      return [figure(pulse, FigureKind.DashPair, { ...at, size: fit(0.04), width: 0.008, intensity })];
  }
}
