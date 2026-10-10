// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { TOP_CHROME_KEEP_OUT_Y } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { BRAND_EXCLUSION_MARGIN, brandExclusionZones, exportKeepOut, veilInSquare } from "./brand-exclusion";
import { QUALITIES, VIDEO_FORMATS, frameSize } from "../probe/tiers";
// The brand zones come from the brandLayout the frames are drawn with: one per
// format, the same in HD and 4K, and the numbers the scene's own tests use.

describe("brand exclusion zones", () => {
  it("gives one zone per video format, HD and 4K alike", () => {
    expect(brandExclusionZones()).toHaveLength(VIDEO_FORMATS.length);
  });

  it("covers every format's veil with the margin", () => {
    const zones = brandExclusionZones();
    for (const format of VIDEO_FORMATS) {
      for (const quality of QUALITIES) {
        const veil = veilInSquare(frameSize(format, quality));
        const covering = zones.some(
          (zone) =>
            zone.minX <= veil.minX - BRAND_EXCLUSION_MARGIN + 1e-3 &&
            zone.maxX >= veil.maxX + BRAND_EXCLUSION_MARGIN - 1e-3 &&
            zone.minY <= veil.minY - BRAND_EXCLUSION_MARGIN + 1e-3 &&
            zone.maxY >= veil.maxY + BRAND_EXCLUSION_MARGIN - 1e-3,
        );
        expect(covering, `${format} ${quality}`).toBe(true);
      }
    }
  });

  it("matches the zones the scene's tests measure (testing/productions.ts)", () => {
    const zones = [...brandExclusionZones()].sort((a, b) => b.minX - a.minX);
    const measured = [...MEASURED_BRAND_ZONES].sort((a, b) => b.minX - a.minX);
    zones.forEach((zone, index) => {
      const expected = measured[index];
      if (expected === undefined) throw new Error("a measured zone expected");
      for (const key of ["minX", "maxX", "minY", "maxY"] as const) expect(zone[key]).toBeCloseTo(expected[key], 3);
    });
  });

  it("hands the export a frame without chrome, with the page's zones and placement line", () => {
    const keepOut = exportKeepOut();
    expect(keepOut.frameHasChrome).toBe(false);
    expect(keepOut.topY).toBe(TOP_CHROME_KEEP_OUT_Y);
    expect(keepOut.brandZones).toEqual(brandExclusionZones());
  });
});
