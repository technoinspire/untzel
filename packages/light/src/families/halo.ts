// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { UPPER_HALF } from "./shockwave";
import { area, figure, type Pulse } from "./family-context";
// halo: voices on the wall. arc (choir) a wide arc whose curvature the vowel opens; aura
// (vox) an ellipse at the note's height whose proportion the vowel changes. Both breathe
// with the note and carry a soft glow.

export function haloLife(cue: { readonly duration: number; readonly release: number }): number {
  return Math.max(0.4, cue.duration + Math.min(cue.release, 2.5));
}

export function haloPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const intensity = cue.velocity * pulse.level;
  const breath = pulse.isReduced ? 1 : 1 + 0.04 * Math.sin(pulse.beat * Math.PI);
  if (description.shape === "arc") {
    const size = Math.min(anchor.reachX, anchor.reachY * 2) * 0.95 * breath;
    const y = anchor.y + anchor.reachY * 0.6;
    return [
      figure(pulse, FigureKind.Ring, { x: anchor.x, y, size, width: 0.014, aspect: 0.55 + 0.4 * pulse.tone, extra: UPPER_HALF, intensity }),
      area(pulse, AreaKind.Glow, { x: anchor.x, y: y - size * 0.3, size: size * 1.4, width: 0.35, aspect: 0.55, intensity: intensity * 0.45 }),
    ];
  }
  const y = anchor.y + (0.5 - pulse.pitch) * anchor.reachY;
  const size = Math.min(anchor.reachX, anchor.reachY) * 0.8 * breath;
  return [
    figure(pulse, FigureKind.Ellipse, { x: anchor.x, y, size, width: 0.01, aspect: 0.6 + 0.6 * pulse.tone, intensity }),
    area(pulse, AreaKind.Glow, { x: anchor.x, y, size: size * 1.8, width: 0.35, aspect: 0.9, intensity: intensity * 0.45 }),
  ];
}
