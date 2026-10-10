// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { frameStats, type FrameGeometry } from "./frame-stats";
const WIDTH = 40;
const HEIGHT = 40;
/** A grey frame of `level` (sRGB byte), with `paint` overriding single pixels. */
function frame(level: number, paint: (x: number, y: number) => number | null = () => null): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const value = paint(x, y) ?? level;
      data.set([value, value, value, 255], (y * WIDTH + x) * 4);
    }
  }
  return data;
}
const GEOMETRY: FrameGeometry = {
  lineRow: 10,
  tenthUnit: 3,
  excluded: [{ x0: 0, y0: 30, x1: 10, y1: 40 }],
  veils: [{ x0: 0, y0: 30, x1: 10, y1: 40 }],
  zones: [{ centerX: 25, centerY: 25, radiusX: 3, radiusY: 3 }],
};
describe("frameStats", () => {
  it("splits the lit share above and below the line, outside the excluded box", () => {
    const stats = frameStats(frame(200, (x, y) => (y >= 30 && x < 10 ? 0 : null)), WIDTH, HEIGHT, GEOMETRY);
    expect(stats.lit).toBe(1);
    expect(stats.litAbove).toBeCloseTo(400 / 1500, 9);
    expect(stats.litBelow).toBeCloseTo(1100 / 1500, 9);
    expect(stats.veilMax).toBe(0);
  });
  it("finds a dark seam at the line and none in an even frame", () => {
    expect(frameStats(frame(120), WIDTH, HEIGHT, GEOMETRY).seamRatio).toBeCloseTo(1, 6);
    expect(frameStats(frame(120, (_, y) => (y === 10 ? 11 : null)), WIDTH, HEIGHT, GEOMETRY).seamRatio).toBeLessThan(0.1);
  });
  it("counts white pixels", () => {
    expect(frameStats(frame(11, (x) => (x < 10 ? 255 : null)), WIDTH, HEIGHT, GEOMETRY).whiteShare).toBeCloseTo(0.25, 9);
  });
});
