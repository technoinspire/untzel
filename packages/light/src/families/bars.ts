// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { area, fade, figure, pitchOf, type Pulse } from "./family-context";
// bars: keys and plucks on the wall, one bar per note, placed by pitch inside the cell.
// keyboard (piano) narrow bars; tine (epiano) short capsules; drawbar (organ) three tall
// bars; string (pluck) fine strings that shiver and fade; arc (harp) strings on an arc;
// hanging (kalimba) blades hanging from the cell's top, high ones shorter; marimba
// (mallet) horizontal keys stacked by pitch.

export function barsLife(cue: { readonly duration: number; readonly release: number }): number {
  return Math.max(0.3, cue.duration + Math.min(cue.release, 2));
}

export function barsPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const notes = cue.pitches.length > 0 ? cue.pitches.map((midi) => pitchOf(description, { ...cue, pitches: [midi] })) : [pulse.pitch];
  const intensity = cue.velocity * Math.max(pulse.level, 0.2 * fade(pulse, 2));
  const left = anchor.x - anchor.reachX;
  const span = anchor.reachX * 2;
  const glow = area(pulse, AreaKind.Glow, { x: anchor.x, y: anchor.y, size: Math.max(anchor.reachX, anchor.reachY) * 1.35, width: 0.4, aspect: Math.max(0.5, anchor.reachY / Math.max(anchor.reachX, 1e-6)), intensity: cue.velocity * Math.max(pulse.level, 0.5 * fade(pulse, 0.8)) * 0.42 });
  const bar = (x: number, y: number, halfWidth: number, halfHeight: number, rotation = 0, weight = 1): ScenePrimitive =>
    figure(pulse, FigureKind.Bar, { x, y, size: halfWidth, aspect: halfHeight / halfWidth, width: 0.004, rotation, intensity: intensity * weight });
  const xOf = (pitch: number) => left + span * (0.08 + 0.84 * pitch);
  switch (description.shape) {
    case "drawbar":
      return [-1, 0, 1].map((index) => bar(anchor.x + index * anchor.reachX * 0.4, anchor.y, anchor.reachX * 0.08, anchor.reachY * (0.55 + 0.35 * pulse.level), 0, 1 - Math.abs(index) * 0.2)).concat(glow);
    case "tine":
      return notes.map((pitch) => bar(xOf(pitch), anchor.y, 0.012, anchor.reachY * 0.35)).concat(glow);
    case "string": {
      const shiver = pulse.isReduced ? 0 : Math.sin(pulse.age * 60) * 0.004 * (1 - pulse.t);
      return notes.map((pitch) => bar(xOf(pitch) + shiver, anchor.y, 0.004, anchor.reachY * 0.85)).concat(glow);
    }
    case "arc":
      return notes.map((pitch) => {
        const angle = (pitch - 0.5) * 1.6;
        return bar(anchor.x + Math.sin(angle) * anchor.reachX * 0.8, anchor.y + (1 - Math.cos(angle)) * anchor.reachY * 0.5, 0.004, anchor.reachY * 0.7, angle * 0.4);
      }).concat(glow);
    case "hanging":
      return notes.map((pitch) => {
        const length = anchor.reachY * (0.9 - 0.5 * pitch);
        return bar(xOf(pitch), anchor.y - anchor.reachY + length, 0.01, length);
      }).concat(glow);
    case "marimba":
      return notes.map((pitch) => bar(anchor.x, anchor.y + (0.5 - pitch) * anchor.reachY * 1.6, anchor.reachX * (0.85 - 0.4 * pitch), 0.012)).concat(glow);
    default:
      return notes.map((pitch) => bar(xOf(pitch), anchor.y, 0.008, anchor.reachY * 0.8)).concat(glow);
  }
}
