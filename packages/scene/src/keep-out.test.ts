// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { TOP_CHROME_KEEP_OUT_Y, distanceToBox, fileKeepOut, overlapsBox, screenKeepOut, skyAtmosphereLine } from "./keep-out";
import { MEASURED_BRAND_ZONES } from "./testing/productions";
// The page and the file keep the same placement and the same masks; only a frame
// without chrome lets the sky's atmosphere light the band above the line.

describe("keep-out", () => {
  it("gives the page and the file the same brand zones and the same placement line", () => {
    const screen = screenKeepOut(MEASURED_BRAND_ZONES);
    const file = fileKeepOut(MEASURED_BRAND_ZONES);
    expect(file.brandZones).toBe(screen.brandZones);
    expect(file.topY).toBe(TOP_CHROME_KEEP_OUT_Y);
    expect(screen.topY).toBe(TOP_CHROME_KEEP_OUT_Y);
    expect([screen.frameHasChrome, file.frameHasChrome]).toEqual([true, false]);
  });

  it("lets the sky's atmosphere extend in a file only, from the chrome line up", () => {
    expect(skyAtmosphereLine(screenKeepOut([]))).toBeNull();
    expect(skyAtmosphereLine(fileKeepOut([]))).toBe(TOP_CHROME_KEEP_OUT_Y);
  });

  it("measures boxes", () => {
    const box = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    expect(overlapsBox(box, { minX: 0.5, maxX: 2, minY: 0.5, maxY: 2 })).toBe(true);
    expect(overlapsBox(box, { minX: 1, maxX: 2, minY: 0, maxY: 1 })).toBe(false);
    expect(distanceToBox(0.5, 0.5, box)).toBe(0);
    expect(distanceToBox(4, 5, box)).toBe(5);
  });
});
