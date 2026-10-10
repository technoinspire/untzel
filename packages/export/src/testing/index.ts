// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test-only helpers: the card with a part left out and the frame-geometry checks. The
// rule "export-testing-in-tests-only" keeps them out of product code.
import { DESIGN_RADIUS, fitScene } from "@untzel/light/offline";
import type { BrandLayout, CardRect } from "../brand/brand-layout";
import { drawCard, type CardContext, type CardPart } from "../brand/card";
interface Size {
  readonly width: number;
  readonly height: number;
}
export function drawCardForTest(ctx: CardContext, logo: CanvasImageSource, layout: BrandLayout, omit: CardPart | null): void {
  drawCard(ctx, logo, layout, omit);
}
/** Pixels from the frame's centre to the nearest point of a rect. */
export function distanceFromCentre(rect: CardRect, size: Size): number {
  const dx = Math.max(rect.x - size.width / 2, 0, size.width / 2 - (rect.x + rect.w));
  const dy = Math.max(rect.y - size.height / 2, 0, size.height / 2 - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}
/** The rings' design radius in pixels: height units per scene unit × the height. */
export function ringRadius(size: Size): number {
  return DESIGN_RADIUS * fitScene(size).scale * size.height;
}
