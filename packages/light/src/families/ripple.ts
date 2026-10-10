// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, fade, figure, type Pulse } from "./family-context";
// ripple: the hand drums on the floor's wings, flat ellipses like rings on water. triple
// (conga) three ellipses; twin (bongo) two, high on one side, low on the other; core
// (djembe) a ripple with a full centre; falling (tom) sinks inside its cell, larger when low.

const FLAT = 0.32;

export function rippleLife(shape: string, tone: number): number {
  return { triple: 0.6 + tone * 0.4, twin: 0.45, core: 0.7, falling: 0.6 }[shape] ?? 0.5;
}

export function ripplePrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const reach = Math.min(anchor.reachX, anchor.reachY / FLAT);
  const intensity = cue.velocity * fade(pulse, 1.8);
  const ellipse = (x: number, y: number, size: number, weight: number): ScenePrimitive =>
    figure(pulse, FigureKind.Ellipse, { x, y, size: Math.min(reach, size), width: 0.009, aspect: FLAT, intensity: intensity * weight });
  const glow = area(pulse, AreaKind.Glow, { x: anchor.x, y: anchor.y, size: reach * 1.3, width: 0.35, aspect: FLAT * 1.6, intensity: intensity * 0.3 * pulse.ramp });
  switch (description.shape) {
    case "twin": {
      const side = (pulse.pitch - 0.5 >= 0 ? 1 : -1) * description.mirror;
      const x = anchor.x + side * reach * 0.45;
      return [ellipse(x, anchor.y, 0.04 + pulse.grow * reach * 0.5, 1), ellipse(x, anchor.y, 0.02 + pulse.grow * reach * 0.3, 0.6), glow];
    }
    case "core":
      return [figure(pulse, FigureKind.Dot, { x: anchor.x, y: anchor.y, size: 0.03, intensity }), ellipse(anchor.x, anchor.y, 0.05 + pulse.grow * reach * 0.9, 1), glow];
    case "falling": {
      const y = anchor.y - anchor.reachY * 0.6 + pulse.grow * anchor.reachY * 1.2;
      return [ellipse(anchor.x, y, (0.35 + 0.65 * (1 - pulse.pitch)) * reach * (0.5 + 0.5 * pulse.grow), 1), glow];
    }
    default:
      // Under reduced motion the three rings stand still at fixed sizes (families.test.ts
      // found them growing with the pulse's age).
      return [0, 0.08, 0.16].flatMap((lag, index): ScenePrimitive[] => {
        if (pulse.isReduced) return [ellipse(anchor.x, anchor.y, 0.04 + (pulse.grow - index * 0.15) * reach, 1 - index * 0.3)];
        return pulse.age < lag ? [] : [ellipse(anchor.x, anchor.y, 0.04 + Math.min(1, (pulse.age - lag) / pulse.life) * reach, 1 - index * 0.3)];
      }).concat(glow);
  }
}
