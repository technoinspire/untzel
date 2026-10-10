// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: measures the brand mark in a decoded frame. The reference mark drawn
// over black says which pixels are ink (logo, URL) and which are scrim; in a frame that
// carries the mark the ink is bright and the scrim dark whatever the light does, and in
// a frame without it the light does not follow the logo's shape. The same masks moved to
// a stretch of frame without the mark are the negative control.
import { contrastRatio, relativeLuminance, type CardRect } from "@untzel/export";

/** Pixels of a rectangle, by offset inside the rectangle. */
export interface InkMasks {
  readonly rect: CardRect;
  readonly ink: readonly number[];
  readonly scrim: readonly number[];
}

export interface MarkScore {
  /** Share of ink pixels brighter than 200. */
  readonly brightInk: number;
  /** Median ink luma minus the 95th percentile of the scrim's, 0..255. */
  readonly separation: number;
  /** WCAG contrast of the median ink against the 95th percentile of the scrim. */
  readonly contrast: number;
}

/** The floors of a frame that carries the mark. */
export const MARK_BRIGHT_INK = 0.5;
export const MARK_SEPARATION = 100;

const INK_LUMA = 200;
const SCRIM_LUMA = 40;

/** From the mark drawn alone over black, in full-frame ImageData. */
export function inkMasks(markOnBlack: ImageData, rect: CardRect): InkMasks {
  const ink: number[] = [];
  const scrim: number[] = [];
  forEachPixel(rect, (x, y, offset) => {
    const luma = lumaAt(markOnBlack, (y * markOnBlack.width + x) * 4);
    if (luma > INK_LUMA) ink.push(offset);
    else if (luma < SCRIM_LUMA) scrim.push(offset);
  });
  return { rect, ink, scrim };
}

/** `region` is getImageData of `masks.rect` moved down by `shiftY` (0 for the mark itself). */
export function markScore(region: ImageData, masks: InkMasks): MarkScore {
  const ink = masks.ink.map((offset) => pixelAt(region, offset));
  const scrim = masks.scrim.map((offset) => pixelAt(region, offset));
  const inkLumas = ink.map(luma).sort((a, b) => a - b);
  const scrimLumas = scrim.map(luma).sort((a, b) => a - b);
  const inkMedian = ink[medianIndex(ink, inkLumas)] ?? [0, 0, 0];
  const scrimHigh = scrim[percentileIndex(scrim, scrimLumas, 0.95)] ?? [0, 0, 0];
  return {
    brightInk: inkLumas.filter((value) => value > INK_LUMA).length / Math.max(1, inkLumas.length),
    separation: luma(inkMedian) - luma(scrimHigh),
    contrast: contrastRatio(relativeLuminance(inkMedian), relativeLuminance(scrimHigh)),
  };
}

/** Bright ink, well above its scrim: the mark (or a title drawn like it) is on the frame. */
export function carriesMark(score: MarkScore): boolean {
  return score.brightInk >= MARK_BRIGHT_INK && score.separation >= MARK_SEPARATION;
}

type Rgb = [number, number, number];

function pixelAt(region: ImageData, offset: number): Rgb {
  const index = offset * 4;
  return [region.data[index] ?? 0, region.data[index + 1] ?? 0, region.data[index + 2] ?? 0];
}

function luma(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function lumaAt(image: ImageData, index: number): number {
  return luma([image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0]);
}

function medianIndex(pixels: readonly Rgb[], sorted: readonly number[]): number {
  return percentileIndex(pixels, sorted, 0.5);
}

/** The index in `pixels` whose luma is the given percentile of `sorted`. */
function percentileIndex(pixels: readonly Rgb[], sorted: readonly number[], fraction: number): number {
  const target = sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  return pixels.findIndex((pixel) => luma(pixel) === target);
}

function forEachPixel(rect: CardRect, visit: (x: number, y: number, offset: number) => void): void {
  let offset = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      visit(x, y, offset);
      offset += 1;
    }
  }
}
