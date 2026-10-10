// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { brandLayout, type CardRect } from "./brand-layout";
import { distanceFromCentre, ringRadius } from "../testing";
import { frameSize, QUALITIES, type VideoFormat } from "../probe/tiers";

const FORMATS: readonly VideoFormat[] = ["story", "video"];
const inside = (inner: CardRect, outer: { readonly width: number; readonly height: number }) =>
  inner.x >= 0 && inner.y >= 0 && inner.x + inner.w <= outer.width && inner.y + inner.h <= outer.height;

describe("brandLayout", () => {
  it("is the reference story exactly at 1080 × 1920", () => {
    const layout = brandLayout({ width: 1080, height: 1920 });
    expect(layout.mark.placement).toBe("centred");
    expect(layout.mark.centerX).toBe(540);
    expect(layout.mark.scrim).toEqual({ x: 290, y: 1330, w: 500, h: 176 });
    expect(layout.mark.logo).toEqual({ x: 307, y: 1330, w: 466, h: 72 });
    expect(layout.mark.url).toEqual({ rect: { x: 455, y: 1462, w: 170, h: 44 }, baseline: 1494, fontPx: 32 });
    expect(layout.card.logo).toEqual({ x: 152, y: 823, w: 776, h: 120 });
    expect(layout.card.url).toEqual({ rect: { x: 426, y: 1047, w: 228, h: 56 }, baseline: 1086, fontPx: 44 });
  });

  it("doubles every length at 4K: the same mark at twice the pixels", () => {
    for (const format of FORMATS) {
      const hd = brandLayout(frameSize(format, "hd"));
      const uhd = brandLayout(frameSize(format, "4k"));
      expect(uhd.scale).toBe(2);
      for (const [a, b] of [
        [hd.mark.scrim, uhd.mark.scrim],
        [hd.mark.logo, uhd.mark.logo],
        [hd.card.logo, uhd.card.logo],
        [hd.card.url.rect, uhd.card.url.rect],
      ] as const) {
        expect(b).toEqual({ x: a.x * 2, y: a.y * 2, w: a.w * 2, h: a.h * 2 });
      }
      expect(uhd.mark.url.fontPx).toBe(64);
    }
  });

  it("keeps the mark and the card inside every frame, each on its axis, the logo unstretched", () => {
    for (const format of FORMATS) {
      for (const quality of QUALITIES) {
        const size = frameSize(format, quality);
        const { mark, card, centerX } = brandLayout(size);
        for (const rect of [mark.scrim, mark.logo, mark.url.rect]) {
          expect(inside(rect, size), `${format} ${quality}`).toBe(true);
          expect(Math.abs(rect.x + rect.w / 2 - mark.centerX)).toBeLessThanOrEqual(1);
        }
        for (const rect of [card.logo, card.url.rect]) {
          expect(inside(rect, size), `${format} ${quality}`).toBe(true);
          expect(Math.abs(rect.x + rect.w / 2 - centerX)).toBeLessThanOrEqual(1);
        }
        expect(mark.logo.w / mark.logo.h).toBeCloseTo(880 / 136, 2);
        expect(card.logo.y + card.logo.h).toBeLessThanOrEqual(card.url.rect.y);
      }
    }
  });

  it("puts the 16:9 mark in the safe area's lower-right corner, the same size as the story's", () => {
    const { mark, scale } = brandLayout(frameSize("video", "hd"));
    expect(mark.placement).toBe("corner");
    // 1920 × 1080: 86 px (8 % of the shorter side) from the right and the bottom edges.
    expect(mark.scrim).toEqual({ x: 1334, y: 818, w: 500, h: 176 });
    expect(mark.logo).toEqual({ x: 1351, y: 818, w: 466, h: 72 });
    expect(mark.url).toEqual({ rect: { x: 1499, y: 950, w: 170, h: 44 }, baseline: 982, fontPx: 32 });
    expect(scale).toBe(1);
  });

  it("keeps the 16:9 scrim off the rings: outside the design radius the scene is fitted to", () => {
    for (const quality of QUALITIES) {
      const size = frameSize("video", quality);
      expect(distanceFromCentre(brandLayout(size).mark.scrim, size), quality).toBeGreaterThan(ringRadius(size));
    }
  });

  it("cuts the 16:9 glow out of the rings' disc and leaves the glow behind the logo and the URL whole", () => {
    for (const quality of QUALITIES) {
      const size = frameSize("video", quality);
      const { mark, scale } = brandLayout(size);
      const clearance = mark.ringsClearance;
      expect(clearance, quality).not.toBeNull();
      if (clearance === null) continue;
      expect([clearance.centerX, clearance.centerY]).toEqual([size.width / 2, size.height / 2]);
      expect(clearance.inner, quality).toBeCloseTo(ringRadius(size) + 2 * scale, 6);
      expect(clearance.outer - clearance.inner, quality).toBeCloseTo(16 * scale, 6);
      expect(clearance.outer, `${quality}: the logo outside the cut`).toBeLessThan(distanceFromCentre(mark.logo, size));
      expect(clearance.outer, `${quality}: the URL outside the cut`).toBeLessThan(distanceFromCentre(mark.url.rect, size));
    }
  });

  it("keeps the story's whole glow: its mark sits under the rings by design", () => {
    for (const quality of QUALITIES) expect(brandLayout(frameSize("story", quality)).mark.ringsClearance, quality).toBeNull();
  });
});
