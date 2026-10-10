// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: what the scene tests measure on a rendered frame (RGBA bytes, sRGB), in
// WCAG relative luminance. Pure, so the browser tests and the unit test read pixels the
// same way. Rows and boxes are in the frame's own pixels.
import type { ZoneEllipse } from "@untzel/light/testing";

/** sRGB byte → linear light. */
export const LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
/** #0B0B0C, the stage's own colour. */
export const STAGE_Y = 0.2126 * (LINEAR[11] ?? 0) + 0.7152 * (LINEAR[11] ?? 0) + 0.0722 * (LINEAR[12] ?? 0);
/** #0B0B0C as a luma in byte steps. */
const STAGE_LUMA_BYTE = 0.2126 * 11 + 0.7152 * 11 + 0.0722 * 12;
/** "Visible light" of the quality bar, by lit area. */
export const LIT_Y = 0.08;
/** A channel this high on all three is "white" (R = G = B > 0.95). */
const WHITE_BYTE = Math.ceil(0.95 * 255);

export interface PixelBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface FrameGeometry {
  /** The chrome line's row: the page hides the band above it under its top bar. */
  readonly lineRow: number;
  /** 0.1 u in pixels: the seam check's reach around the line. */
  readonly tenthUnit: number;
  /** Excluded from the lit share (the brand mark's veil plus a margin). */
  readonly excluded: readonly PixelBox[];
  /** Under the veil: no scene light at all before the mark is drawn. */
  readonly veils: readonly PixelBox[];
  /** Each brand zone's dark ellipse (renderers/mask-shape.ts), in pixels, for the edge check. */
  readonly zones: readonly ZoneEllipse[];
}

export interface FrameStats {
  /** Mean relative luminance of the frame. */
  readonly mean: number;
  /** Means of the nine quarter-frame windows (3 × 3, half-size, at half steps). */
  readonly windows: readonly number[];
  readonly whiteShare: number;
  /** Share of pixels above LIT_Y outside `excluded`: the whole frame, above and below the line. */
  readonly lit: number;
  readonly litAbove: number;
  readonly litBelow: number;
  /** Mean luma above the stage's, in sRGB byte steps (x/255), in the band over the line. */
  readonly bandMean: number;
  /** Brightest luminance above the stage under a veil. */
  readonly veilMax: number;
  /** Darkest row within ±0.1 u of the line over the mean of its neighbours within 0.1 u. */
  readonly seamRatio: number;
}

function inside(boxes: readonly PixelBox[], x: number, y: number): boolean {
  return boxes.some((box) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1);
}

/** Linear relative luminance of every pixel. */
export function luminanceOf(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const y = new Float32Array(width * height);
  for (let index = 0; index < y.length; index += 1) {
    y[index] = 0.2126 * (LINEAR[data[index * 4] ?? 0] ?? 0) + 0.7152 * (LINEAR[data[index * 4 + 1] ?? 0] ?? 0) + 0.0722 * (LINEAR[data[index * 4 + 2] ?? 0] ?? 0);
  }
  return y;
}

function windowMeans(y: Float32Array, width: number, height: number): number[] {
  const means: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const x0 = Math.floor((column * width) / 4);
      const y0 = Math.floor((row * height) / 4);
      let sum = 0;
      for (let py = y0; py < y0 + height / 2; py += 1) for (let px = x0; px < x0 + width / 2; px += 1) sum += y[py * width + px] ?? 0;
      means.push(sum / ((width / 2) * (height / 2)));
    }
  }
  return means;
}

function seamRatio(y: Float32Array, width: number, height: number, geometry: FrameGeometry): number {
  const reach = Math.max(1, Math.round(geometry.tenthUnit));
  const rowMean = (row: number) => {
    let sum = 0;
    for (let x = 0; x < width; x += 1) sum += y[row * width + x] ?? 0;
    return sum / width;
  };
  const from = Math.max(reach, Math.round(geometry.lineRow) - reach);
  const to = Math.min(height - reach - 1, Math.round(geometry.lineRow) + reach);
  const rows = Array.from({ length: height }, (_, row) => (row >= from - reach && row <= to + reach ? rowMean(row) : 0));
  let worst = Infinity;
  for (let row = from; row <= to; row += 1) {
    let sum = 0;
    for (let offset = 1; offset <= reach; offset += 1) sum += (rows[row - offset] ?? 0) + (rows[row + offset] ?? 0);
    const neighbours = sum / (2 * reach);
    if (neighbours > STAGE_Y * 4) worst = Math.min(worst, (rows[row] ?? 0) / neighbours);
  }
  return worst === Infinity ? 1 : worst;
}

// Over 40 lines: test build only; one pass over the frame's pixels gathers every measure.
export function frameStats(data: Uint8ClampedArray, width: number, height: number, geometry: FrameGeometry): FrameStats {
  const y = luminanceOf(data, width, height);
  let sum = 0;
  let white = 0;
  let band = 0;
  let bandCount = 0;
  let veilMax = 0;
  const lit = { above: 0, below: 0, aboveCount: 0, belowCount: 0 };
  for (let py = 0; py < height; py += 1) {
    const isAbove = py < geometry.lineRow;
    for (let px = 0; px < width; px += 1) {
      const index = py * width + px;
      const value = y[index] ?? 0;
      sum += value;
      if ((data[index * 4] ?? 0) >= WHITE_BYTE && (data[index * 4 + 1] ?? 0) >= WHITE_BYTE && (data[index * 4 + 2] ?? 0) >= WHITE_BYTE) white += 1;
      if (isAbove) {
        band += Math.max(0, 0.2126 * (data[index * 4] ?? 0) + 0.7152 * (data[index * 4 + 1] ?? 0) + 0.0722 * (data[index * 4 + 2] ?? 0) - STAGE_LUMA_BYTE);
        bandCount += 1;
      }
      if (inside(geometry.veils, px, py)) veilMax = Math.max(veilMax, value - STAGE_Y);
      if (inside(geometry.excluded, px, py)) continue;
      if (isAbove) {
        lit.aboveCount += 1;
        if (value > LIT_Y) lit.above += 1;
      } else {
        lit.belowCount += 1;
        if (value > LIT_Y) lit.below += 1;
      }
    }
  }
  const counted = lit.aboveCount + lit.belowCount;
  return {
    mean: sum / (width * height),
    windows: windowMeans(y, width, height),
    whiteShare: white / (width * height),
    lit: (lit.above + lit.below) / Math.max(1, counted),
    litAbove: lit.above / Math.max(1, counted),
    litBelow: lit.below / Math.max(1, counted),
    bandMean: bandCount === 0 ? 0 : band / bandCount,
    veilMax: Math.max(0, veilMax),
    seamRatio: seamRatio(y, width, height, geometry),
  };
}
