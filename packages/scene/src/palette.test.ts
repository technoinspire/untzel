// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { MAX_SECTION_SHIFT_DEGREES, TRACK_PALETTE_SIZE, oklchToLinearSrgb, paletteAt, toHex, type SrgbColor } from "./palette";

const linear = (channel: number): number => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const luminance = (color: SrgbColor): number => 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const STAGE = { r: 11 / 255, g: 11 / 255, b: 12 / 255 };
const SURFACE = { r: 0x16 / 255, g: 0x17 / 255, b: 0x19 / 255 };

/** OKLab of an sRGB colour, for ΔE_OK. */
function oklab(color: SrgbColor): readonly [number, number, number] {
  const [r, g, b] = [linear(color.r), linear(color.g), linear(color.b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const deltaE = (a: SrgbColor, b: SrgbColor): number => Math.hypot(...oklab(a).map((value, index) => value - (oklab(b)[index] ?? 0)));

describe("the track palette", () => {
  it("is the reference set at turn 0", () => {
    expect(paletteAt(0).map(toHex)).toEqual(["#F19773", "#D2AC4E", "#94C16F", "#47CAB0", "#45C2E7", "#8FAEFE", "#CB9AE8", "#EE90B2"]);
  });

  it("stays inside sRGB at every turn, so lightness and chroma stay equal", () => {
    for (let shift = -MAX_SECTION_SHIFT_DEGREES; shift <= MAX_SECTION_SHIFT_DEGREES; shift += 1) {
      for (let slot = 0; slot < TRACK_PALETTE_SIZE; slot += 1) {
        for (const channel of oklchToLinearSrgb(0.76, 0.12, 42 + 45 * slot + shift)) {
          expect(channel).toBeGreaterThanOrEqual(-1e-9);
          expect(channel).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it("keeps 4.5:1 over the stage and the surface, and neighbours apart, at every turn", () => {
    for (let shift = -MAX_SECTION_SHIFT_DEGREES; shift <= MAX_SECTION_SHIFT_DEGREES; shift += 1) {
      const colors = paletteAt(shift);
      for (const [index, color] of colors.entries()) {
        expect(contrast(luminance(color), luminance(STAGE))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(luminance(color), luminance(SURFACE))).toBeGreaterThanOrEqual(4.5);
        expect(deltaE(color, colors[(index + 1) % colors.length] as SrgbColor)).toBeGreaterThan(0.08);
      }
    }
  });

  it("clamps the turn to ±12°", () => {
    expect(paletteAt(40)).toEqual(paletteAt(12));
    expect(paletteAt(Number.NaN)).toEqual(paletteAt(0));
  });
});
