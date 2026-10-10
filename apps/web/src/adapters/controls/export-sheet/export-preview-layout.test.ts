// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { brandLayout } from "@untzel/export";
import { describe, expect, it } from "vitest";
import { previewLayoutOf } from "./export-preview-layout";

describe("previewLayoutOf", () => {
  it("is the story preview at 9:16: the numbers the stylesheet used to copy", () => {
    const layout = previewLayoutOf(brandLayout({ width: 1080, height: 1920 }));
    expect(layout.aspect).toBeCloseTo(0.5625, 9);
    expect(layout.scrim.left * 100).toBeCloseTo(26.852, 3);
    expect(layout.scrim.top * 100).toBeCloseTo(69.271, 3);
    expect(layout.markLogo.width * 100).toBeCloseTo(43.15, 2);
    expect(layout.markUrl.top * 100).toBeCloseTo(76.65, 1);
    expect(layout.markUrl.size * 100).toBeCloseTo(2.963, 3);
    expect(layout.cardUrl.top * 100).toBeCloseTo(54.96, 1);
    expect(layout.ringsClearance).toBeNull();
  });

  it("is the same picture at HD and 4K, and a wide one at 16:9", () => {
    expect(previewLayoutOf(brandLayout({ width: 3840, height: 2160 }))).toEqual(previewLayoutOf(brandLayout({ width: 1920, height: 1080 })));
    const wide = previewLayoutOf(brandLayout({ width: 1920, height: 1080 }));
    expect(wide.aspect).toBeCloseTo(16 / 9, 9);
    expect(wide.scrim.width).toBeCloseTo(500 / 1920, 9);
    // The 16:9 mark sits in the lower-right corner; the card stays on the centre line.
    expect(wide.scrim.left).toBeCloseTo(1334 / 1920, 9);
    expect(wide.markUrl.center).toBeCloseTo(1584 / 1920, 9);
    expect(wide.cardUrl.center).toBeCloseTo(0.5, 9);
    // The glow's cut about the rings: 453.6 + 2 px, faded back by 471.6 px of 1920.
    expect(wide.ringsClearance?.centerY).toBeCloseTo(0.5, 9);
    expect(wide.ringsClearance?.inner).toBeCloseTo(455.6 / 1920, 9);
    expect(wide.ringsClearance?.outer).toBeCloseTo(471.6 / 1920, 9);
  });
});
