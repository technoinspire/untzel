// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { SAFE_MARGIN } from "@untzel/light/offline";
import { describe, expect, it } from "vitest";
import { brandLayout } from "../brand/brand-layout";
import { distanceFromCentre, ringRadius } from "../testing";
import { frameSize, QUALITIES, type VideoFormat } from "../probe/tiers";
import { CAPTION_MAX_WIDTH, captionRect } from "./title-caption";
const FORMATS: readonly VideoFormat[] = ["story", "video"];
describe("captionRect", () => {
  it("at its widest never crosses the mark's scrim, stays in the safe area and, in the corner, off the rings", () => {
    for (const format of FORMATS) {
      for (const quality of QUALITIES) {
        const size = frameSize(format, quality);
        const layout = brandLayout(size);
        const rect = captionRect(layout, 10_000 * layout.scale);
        const margin = SAFE_MARGIN * Math.min(size.width, size.height);
        const label = `${format} ${quality}`;
        expect(rect.w, label).toBe(CAPTION_MAX_WIDTH[layout.mark.placement] * layout.scale);
        expect(rect.y + rect.h, label).toBeLessThanOrEqual(layout.mark.scrim.y);
        expect(rect.x, label).toBeGreaterThanOrEqual(margin);
        expect(rect.x + rect.w, label).toBeLessThanOrEqual(size.width - margin);
        expect(rect.y, label).toBeGreaterThanOrEqual(Math.round(size.height * 0.14));
        if (layout.mark.placement === "corner") {
          expect(distanceFromCentre(rect, size), label).toBeGreaterThan(ringRadius(size));
        }
      }
    }
  });
  it("gives the pills of the mocks", () => {
    const video = brandLayout({ width: 1920, height: 1080 });
    const story = brandLayout({ width: 1080, height: 1920 });
    expect(captionRect(video, 10_000)).toEqual({ x: 1384, y: 726, w: 400, h: 76 });
    expect(captionRect(story, 10_000)).toEqual({ x: 120, y: 1238, w: 840, h: 76 });
  });
  it("shrinks around the mark's axis for a short title", () => {
    const video = brandLayout({ width: 1920, height: 1080 });
    const rect = captionRect(video, 200);
    expect(rect.w).toBe(272);
    expect(rect.x + rect.w / 2).toBe(video.mark.centerX);
  });
});
