// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sheet's drawn preview takes its geometry from the file's own layout (brandLayout of
// @untzel/export), as fractions of the frame, so the preview and the file cannot drift
// apart. Pure; the export module is handed in, as it loads on demand.
import type { ExportPreviewLayout, FractionLine, FractionRect } from "@untzel/presentation/view-model";
import type { BrandLayout, CardRect, TextLine } from "@untzel/export";

/** Hanken Grotesk's ascent at line-height 1: the box top is the baseline less this share of the size. */
export const TEXT_ASCENT = 0.7;

export function previewLayoutOf(layout: BrandLayout): ExportPreviewLayout {
  const { width, height } = layout.size;
  const rect = (box: CardRect): FractionRect => ({ left: box.x / width, top: box.y / height, width: box.w / width, height: box.h / height });
  const line = (text: TextLine, axis: number): FractionLine => ({
    top: (text.baseline - TEXT_ASCENT * text.fontPx) / height,
    size: text.fontPx / width,
    center: axis / width,
  });
  const clearance = layout.mark.ringsClearance;
  return {
    aspect: width / height,
    scrim: rect(layout.mark.scrim),
    scrimRadius: layout.mark.scrimRadius / width,
    markLogo: rect(layout.mark.logo),
    markUrl: line(layout.mark.url, layout.mark.centerX),
    ringsClearance: clearance === null ? null : { centerX: clearance.centerX / width, centerY: clearance.centerY / height, inner: clearance.inner / width, outer: clearance.outer / width },
    cardLogo: rect(layout.card.logo),
    cardUrl: line(layout.card.url, layout.centerX),
  };
}
