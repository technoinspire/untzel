// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: how much of the drawn brand mark (scrim included) falls on the rings.
// The rings are fitted by the frame's shorter side to the scene's design radius
// (fitScene); in a landscape frame the mark sits in the safe area's corner, and none of its
// pixels may land inside that disc.
import { DESIGN_RADIUS, fitScene } from "@untzel/light";

export interface FrameSizeLike {
  readonly width: number;
  readonly height: number;
}

/** The rings' design radius in pixels of a frame this size, about its centre. */
export function ringRadiusPixels(size: FrameSizeLike): number {
  return DESIGN_RADIUS * fitScene(size).scale * size.height;
}

/**
 * Pixels of `markOnBlack` (the mark drawn alone over opaque black: the scrim leaves 7/255
 * where it falls) that are not black inside the rings' disc.
 */
export function markPixelsInRings(markOnBlack: ImageData): number {
  return pixelsInRings(markOnBlack, (data, offset) => (data[offset] ?? 0) + (data[offset + 1] ?? 0) + (data[offset + 2] ?? 0) > 0);
}
/** Pixels of `markAlone` (the mark drawn on a transparent canvas) with any alpha inside the rings' disc: the faintest glow counts. */
export function glowPixelsInRings(markAlone: ImageData): number {
  return pixelsInRings(markAlone, (data, offset) => (data[offset + 3] ?? 0) > 0);
}
function pixelsInRings(image: ImageData, isMarked: (data: Uint8ClampedArray, offset: number) => boolean): number {
  const { width, height, data } = image;
  const radius = ringRadiusPixels({ width, height });
  const centreX = width / 2;
  const centreY = height / 2;
  let count = 0;
  const top = Math.max(0, Math.floor(centreY - radius));
  const bottom = Math.min(height, Math.ceil(centreY + radius));
  for (let y = top; y < bottom; y += 1) {
    const half = Math.sqrt(Math.max(0, radius * radius - (y + 0.5 - centreY) ** 2));
    const left = Math.max(0, Math.floor(centreX - half));
    const right = Math.min(width, Math.ceil(centreX + half));
    for (let x = left; x < right; x += 1) {
      if (isMarked(data, (y * width + x) * 4)) count += 1;
    }
  }
  return count;
}
