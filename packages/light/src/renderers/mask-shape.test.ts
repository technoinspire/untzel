// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { MASK_FEATHER, brandKeepAt, ellipseDistance, featherRings, smoothstep, zoneEllipse } from "./mask-shape";
// The brand zones' darkness: dark over the whole box, a soft ellipse around it,
// no straight edge, and the 2D level's rings give the shader's falloff.
const FEATHER = MASK_FEATHER;
describe("mask shape", () => {
  it("keeps every point of each box dark, its corners included", () => {
    for (const box of MEASURED_BRAND_ZONES) {
      for (const [x, y] of [[box.minX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY], [box.maxX, box.minY], [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]] as const) {
        expect(brandKeepAt(x, y, [box], FEATHER)).toBeLessThan(1e-9);
      }
    }
  });
  it("measures the feather as a distance: a point the feather away from the ellipse keeps all its light", () => {
    for (const box of MEASURED_BRAND_ZONES) {
      const ellipse = zoneEllipse(box);
      for (let step = 0; step < 32; step += 1) {
        const angle = (step / 32) * Math.PI * 2;
        const onX = ellipse.centerX + Math.cos(angle) * ellipse.radiusX;
        const onY = ellipse.centerY + Math.sin(angle) * ellipse.radiusY;
        expect(Math.abs(ellipseDistance(onX, onY, ellipse))).toBeLessThan(1e-9);
        // The outward normal of the ellipse at that point.
        const nx = Math.cos(angle) / ellipse.radiusX;
        const ny = Math.sin(angle) / ellipse.radiusY;
        const length = Math.hypot(nx, ny);
        const far = brandKeepAt(onX + (nx / length) * FEATHER * 1.1, onY + (ny / length) * FEATHER * 1.1, [box], FEATHER);
        expect(far).toBeGreaterThan(0.97);
      }
    }
  });
  it("never steps: along any row through a zone, the kept share moves by at most 2.5 % per pixel of the 1440 stage", () => {
    // The 1440 stage at DPR 1 draws about 210 px per u. Under light below 0.8 that keeps every
    // luminance step under 0.02 (the browser measure in scene-captures.browser.ts).
    const pixel = 1 / 210;
    for (const box of MEASURED_BRAND_ZONES) {
      for (let row = -0.5; row <= 1.5; row += 0.05) {
        for (let x = -2.4; x <= 2.4; x += pixel) {
          const step = Math.abs(brandKeepAt(x + pixel, row, [box], FEATHER) - brandKeepAt(x, row, [box], FEATHER));
          expect(step).toBeLessThanOrEqual(0.025);
        }
      }
    }
  });
  it("2D rings leave in each band the shader's light at the band's middle", () => {
    const steps = 6;
    const rings = featherRings(FEATHER, steps);
    expect(rings.map((ring) => ring.offset)).toEqual(Array.from({ length: steps }, (_, index) => ((steps - index) * FEATHER) / steps));
    for (let band = 1; band <= steps; band += 1) {
      const kept = rings.filter((ring) => ring.offset >= (band * FEATHER) / steps - 1e-12).reduce((light, ring) => light * (1 - ring.alpha), 1);
      expect(kept).toBeCloseTo(smoothstep(0, FEATHER, ((band - 0.5) * FEATHER) / steps), 12);
    }
  });
});
