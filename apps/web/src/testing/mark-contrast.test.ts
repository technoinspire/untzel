// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { markContrast } from "./mark-contrast";
const WIDTH = 30;
const HEIGHT = 20;
type Rgba = readonly [number, number, number, number];
function image(paint: (x: number, y: number) => Rgba): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) data.set(paint(x, y), (y * WIDTH + x) * 4);
  return data;
}
const LOGO = { x: 0, y: 0, w: 20, h: 10 };
const URL_RECT = { x: 0, y: 10, w: 20, h: 10 };
const GLOW: Rgba = [11, 11, 12, 153];
/** The mark: glow everywhere, a white bar at x 2..4 in both rectangles, an orange bar at x 12..14 in the logo. */
const MARK = image((x, y) => {
  if (x >= 2 && x <= 4) return [255, 255, 255, 255];
  if (y < 10 && x >= 12 && x <= 14) return [246, 93, 0, 255];
  return GLOW;
});
describe("markContrast", () => {
  it("reads white text and the accent against the glow over a black frame", () => {
    const result = markContrast(image(() => [0, 0, 0, 255]), MARK, WIDTH, LOGO, URL_RECT);
    expect(result.logoWhiteShare).toBeCloseTo(30 / 200, 9);
    expect(result.urlWhiteShare).toBeCloseTo(30 / 200, 9);
    expect(result.logoAccentShare).toBeCloseTo(30 / 200, 9);
    expect(result.textContrast).toBeGreaterThan(15);
    expect(result.accentContrast).toBeGreaterThan(5);
  });
  it("takes the worst background: a white pixel of light under the glow, away from the ink", () => {
    const light = image((x, y) => (x === 9 && y === 15 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const result = markContrast(light, MARK, WIDTH, LOGO, URL_RECT);
    // 0.6 × 11 + 0.4 × 255 = 108.6 → 109: the glow's own worst case of brand-mark.ts.
    expect(result.textContrast).toBeCloseTo(5.17, 1);
    expect(result.accentContrast).toBeLessThan(3);
  });
  it("leaves the light next to the ink out of the background (anti-aliased edges)", () => {
    const light = image((x) => (x === 5 || x === 6 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    expect(markContrast(light, MARK, WIDTH, LOGO, URL_RECT).textContrast).toBeGreaterThan(15);
  });
  it("finds no ink when the layer is the glow alone", () => {
    const result = markContrast(image(() => [0, 0, 0, 255]), image(() => GLOW), WIDTH, LOGO, URL_RECT);
    expect(result.logoWhiteShare).toBe(0);
    expect(result.accentContrast).toBe(Number.POSITIVE_INFINITY);
  });
});
