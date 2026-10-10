// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, type Area } from "../composer/scene-primitive";
import { area, type Pulse } from "./family-context";
// The light version of a scene: above the frame's budget, a track of lower
// priority keeps a soft dot of its colour at its anchor instead of its full figures.

export function lightVersion(pulse: Pulse, energy: number): Area {
  const { anchor } = pulse;
  const size = Math.min(0.12, Math.max(anchor.spansWidth ? 0.08 : Math.min(anchor.reachX, anchor.reachY), 0.04));
  return area(pulse, AreaKind.Glow, {
    x: anchor.x,
    y: anchor.y,
    size,
    width: 0.2,
    intensity: (0.12 + 0.25 * energy) * Math.max(pulse.level, 1 - pulse.t),
  });
}
