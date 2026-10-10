// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { glowPixelsInRings, markPixelsInRings, ringRadiusPixels } from "./mark-clearance";

/** An opaque black frame with one grey rectangle, as ImageData has it. */
function frameWith(width: number, height: number, rect: { x: number; y: number; w: number; h: number }): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) data.set([7, 7, 7, 255], (y * width + x) * 4);
  }
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}

describe("mark clearance", () => {
  it("fits the rings to the shorter side's safe area: 453.6 px at 1080", () => {
    expect(ringRadiusPixels({ width: 1920, height: 1080 })).toBeCloseTo(453.6, 6);
    expect(ringRadiusPixels({ width: 1080, height: 1920 })).toBeCloseTo(453.6, 6);
  });

  it("counts the mark's pixels inside the disc and none outside it", () => {
    // The 16:9 corner scrim: its nearest point is 466 px from the centre.
    expect(markPixelsInRings(frameWith(192, 108, { x: 133, y: 82, w: 50, h: 17 }))).toBe(0);
    // The story's anchor at 16:9, across the lower arc.
    expect(markPixelsInRings(frameWith(192, 108, { x: 71, y: 75, w: 50, h: 17 }))).toBeGreaterThan(0);
  });
  it("counts any alpha of a transparent mark layer inside the disc, even with no colour", () => {
    const faint = { width: 192, height: 108, data: new Uint8ClampedArray(192 * 108 * 4), colorSpace: "srgb" } as ImageData;
    faint.data[(54 * 192 + 96) * 4 + 3] = 1;
    expect(glowPixelsInRings(faint)).toBe(1);
    expect(markPixelsInRings(faint)).toBe(0);
  });
});
