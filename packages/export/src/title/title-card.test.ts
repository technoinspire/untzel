// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { brandLayout } from "../brand/brand-layout";
import { frameSize, QUALITIES, type VideoFormat } from "../probe/tiers";
import { fitTitleLines, titleCardHeight, titleCardOpacity, titleCardRect, topBand, type MeasureText } from "./title-card";
const FORMATS: readonly VideoFormat[] = ["story", "video"];
/** Every character half its size wide: at 96 a line holds 16 characters, at 72 about 22. */
const measure: MeasureText = (text, units) => [...text].length * units * 0.52;
describe("fitTitleLines", () => {
  it("keeps a short title on one line at 96", () => {
    expect(fitTitleLines("Midnight Coast", measure)).toEqual({ units: 96, lines: ["Midnight Coast"] });
  });
  it("breaks between words, two lines at 96", () => {
    expect(fitTitleLines("Midnight Coast at Dawn", measure)).toEqual({ units: 96, lines: ["Midnight Coast", "at Dawn"] });
  });
  it("drops to 72 when 96 would take three lines", () => {
    const fitted = fitTitleLines("Remix of Midnight Coast at the Harbour", measure);
    expect(fitted.units).toBe(72);
    expect(fitted.lines).toEqual(["Remix of Midnight", "Coast at the Harbour"]);
  });
  it("cuts the third line at 72 with an ellipsis when even that is not enough", () => {
    const fitted = fitTitleLines("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen", measure);
    expect(fitted.units).toBe(72);
    expect(fitted.lines).toHaveLength(3);
    expect(fitted.lines[2]?.endsWith("…")).toBe(true);
    for (const line of fitted.lines) expect(measure(line, 72)).toBeLessThanOrEqual(804);
  });
  it("cuts a single word wider than the line", () => {
    const fitted = fitTitleLines("a".repeat(40), measure);
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.lines[0]?.endsWith("…")).toBe(true);
  });
});
describe("titleCardHeight", () => {
  it("is 300, 404, 352 and 430 for the four cases of line count and title size", () => {
    expect(titleCardHeight(1, 96)).toBe(300);
    expect(titleCardHeight(2, 96)).toBe(404);
    expect(titleCardHeight(2, 72)).toBe(352);
    expect(titleCardHeight(3, 72)).toBe(430);
  });
});
describe("titleCardRect", () => {
  it("sits between the top band and the mark's scrim in every format and quality, at its tallest", () => {
    for (const format of FORMATS) {
      for (const quality of QUALITIES) {
        const size = frameSize(format, quality);
        const layout = brandLayout(size);
        const rect = titleCardRect(layout, size, titleCardHeight(3, 72));
        expect(rect.y, `${format} ${quality}`).toBeGreaterThanOrEqual(Math.round(size.height * 0.14));
        expect(rect.y + rect.h, `${format} ${quality}`).toBeLessThanOrEqual(layout.mark.scrim.y);
        expect(rect.x + rect.w / 2).toBeCloseTo(size.width / 2, 0);
      }
    }
  });
  it("gives the rectangles of the mocks", () => {
    const video = { width: 1920, height: 1080 };
    const story = { width: 1080, height: 1920 };
    expect(titleCardRect(brandLayout(video), video, titleCardHeight(3, 72))).toEqual({ x: 510, y: 270, w: 900, h: 430 });
    expect(titleCardRect(brandLayout(video), video, titleCardHeight(1, 96))).toEqual({ x: 510, y: 335, w: 900, h: 300 });
    expect(titleCardRect(brandLayout(story), story, titleCardHeight(1, 96))).toEqual({ x: 90, y: 650, w: 900, h: 300 });
    expect(titleCardRect(brandLayout(story), story, titleCardHeight(2, 72))).toEqual({ x: 90, y: 624, w: 900, h: 352 });
  });
  it("doubles in 4K, within the one rounding of the top (a share of the height)", () => {
    const hd = { width: 1080, height: 1920 };
    const uhd = { width: 2160, height: 3840 };
    const small = titleCardRect(brandLayout(hd), hd, 300);
    const large = titleCardRect(brandLayout(uhd), uhd, 300);
    expect({ x: large.x, w: large.w, h: large.h }).toEqual({ x: small.x * 2, w: small.w * 2, h: small.h * 2 });
    expect(Math.abs(large.y - small.y * 2)).toBeLessThanOrEqual(1);
  });
  it("the top band is a share of the height", () => {
    expect([topBand({ width: 1080, height: 1920 }), topBand({ width: 2160, height: 3840 })]).toEqual([269, 538]);
    expect([topBand({ width: 1920, height: 1080 }), topBand({ width: 3840, height: 2160 })]).toEqual([151, 302]);
  });
});
describe("titleCardOpacity", () => {
  it("is whole until the exit, then eases out to nearly nothing", () => {
    expect(titleCardOpacity(0, false)).toBe(1);
    expect(titleCardOpacity(35, false)).toBe(1);
    expect(titleCardOpacity(36, false)).toBe(1);
    expect(titleCardOpacity(37, false)).toBeCloseTo(0.462, 3);
    expect(titleCardOpacity(40, false)).toBeCloseTo(0.045, 3);
    const last = titleCardOpacity(44, false);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(0.01);
    for (let frame = 36; frame < 44; frame += 1) {
      expect(titleCardOpacity(frame + 1, false)).toBeLessThan(titleCardOpacity(frame, false));
    }
  });
  it("stays whole to the last card frame with reduced motion", () => {
    for (let frame = 0; frame <= 44; frame += 1) expect(titleCardOpacity(frame, true)).toBe(1);
  });
});
