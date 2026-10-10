// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import {
  LOWER_THIRD_TOP,
  MARK_LOGO_RECT,
  MARK_SCRIM_RECT,
  MARK_URL_FONT,
  MARK_URL_RECT,
  SAFE_BOTTOM,
  SAFE_TOP,
  contrastRatio,
  relativeLuminance,
  scrimOver,
  worstCaseMarkContrast,
} from "./brand-mark";
import type { CardRect } from "./card";
const VIDEO_WIDTH = 1080;

const inside = (inner: CardRect, outer: CardRect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

describe("brand mark", () => {
  it("sits in the lower third, clear of Instagram's bands, on its scrim", () => {
    expect([SAFE_TOP, SAFE_BOTTOM, LOWER_THIRD_TOP]).toEqual([269, 1536, 1280]);
    expect(MARK_SCRIM_RECT.y).toBeGreaterThanOrEqual(LOWER_THIRD_TOP);
    expect(MARK_SCRIM_RECT.y + MARK_SCRIM_RECT.h).toBeLessThanOrEqual(SAFE_BOTTOM);
    expect(inside(MARK_LOGO_RECT, MARK_SCRIM_RECT)).toBe(true);
    expect(inside(MARK_URL_RECT, MARK_SCRIM_RECT)).toBe(true);
    expect(MARK_LOGO_RECT.y + MARK_LOGO_RECT.h).toBeLessThanOrEqual(MARK_URL_RECT.y);
  });

  it("the logo is at least 48 px high, unstretched and centred; the URL at least 28 px", () => {
    expect(MARK_LOGO_RECT.h).toBeGreaterThanOrEqual(48);
    expect(MARK_LOGO_RECT.w / MARK_LOGO_RECT.h).toBeCloseTo(880 / 136, 2);
    expect(Math.abs(MARK_LOGO_RECT.x + MARK_LOGO_RECT.w / 2 - VIDEO_WIDTH / 2)).toBeLessThanOrEqual(1);
    expect(Number(/(\d+)px/.exec(MARK_URL_FONT)?.[1])).toBeGreaterThanOrEqual(28);
  });

  it("keeps white at 4.5:1 or more even over a white frame", () => {
    expect(worstCaseMarkContrast()).toBeGreaterThanOrEqual(4.5);
    expect(worstCaseMarkContrast()).toBeCloseTo(5.2, 1);
    // Darker frames only help.
    expect(contrastRatio(1, relativeLuminance(scrimOver([128, 128, 128])))).toBeGreaterThan(worstCaseMarkContrast());
  });

  it("measures luminance and contrast as WCAG does", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
  });
});
