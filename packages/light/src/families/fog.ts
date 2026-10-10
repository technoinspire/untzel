// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, type Pulse } from "./family-context";
// fog: pads fill the field with soft light. cloud (pad) four flow-noise lobes (the shader
// moves them); veil (strings) two long veils; panel (stab) a short panel of fog. The light
// spills past the cell: it is area light, held by its zone's cap.

export function fogLife(cue: { readonly duration: number; readonly release: number }): number {
  return Math.max(0.3, cue.duration + Math.min(cue.release, 2.5));
}

export function fogPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const intensity = cue.velocity * pulse.level * pulse.ramp;
  const reach = Math.max(anchor.reachX, anchor.reachY);
  switch (description.shape) {
    case "veil":
      return [-1, 1].map((side) =>
        area(pulse, AreaKind.Glow, { x: anchor.x, y: anchor.y + side * anchor.reachY * 0.35, size: Math.max(0.7, reach * 1.6) * pulse.scale, width: 0.3, aspect: 0.22, rotation: side * 0.06, intensity: intensity * 0.5 }),
      );
    case "panel":
      return [area(pulse, AreaKind.Glow, { x: anchor.x, y: anchor.y, size: Math.max(0.45, reach * 1.2), width: 0.55, aspect: 0.5, intensity: cue.velocity * 0.6 * Math.max(pulse.level, 1 - pulse.t) })];
    default:
      return [area(pulse, AreaKind.Cloud, { x: anchor.x, y: anchor.y, size: Math.max(1.25, reach * 2.2) * pulse.scale, width: 0.4, aspect: 0.58, intensity: intensity * 0.75 })];
  }
}
