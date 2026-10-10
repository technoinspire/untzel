// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: the brand mark's contrast over a file frame of the
// scene. The mark is its own layer, drawn alone on a transparent canvas by drawBrandMark (as
// the export prepares it), and is composited here over the light the way the canvas does,
// source-over in 8-bit sRGB. Inside the logo's and the URL's rectangles, the ink is every
// pixel the layer paints brighter than its dark glow, grown by INK_GROWTH px for the
// anti-aliased edges; the rest is the background the ink is read against, glow, shadow and
// light together. The worst case is the brightest background pixel against the dimmest
// opaque ink pixel of each kind: the white letters (text, 4.5:1) and the orange accent of
// the lockup (a graphic, 3:1).
import { contrastRatio, relativeLuminance, type CardRect } from "@untzel/export";

export interface MarkContrast {
  /** Opaque white ink pixels in the logo's rectangle, over the rectangle's area. */
  readonly logoWhiteShare: number;
  /** Opaque accent (orange) ink pixels in the logo's rectangle, over its area. */
  readonly logoAccentShare: number;
  /** Opaque white ink pixels in the URL's rectangle, over its area. */
  readonly urlWhiteShare: number;
  /** The brightest background luminance under the logo and the URL. */
  readonly backgroundMaxY: number;
  /** The dimmest opaque white ink against that background. */
  readonly textContrast: number;
  /** The dimmest opaque accent ink against that background (Infinity when there is none). */
  readonly accentContrast: number;
}

/** The glow and the shadow are (11, 11, 12): about 0.004. Anything brighter is ink. */
const INK_Y = 0.02;
const INK_GROWTH = 2;
const OPAQUE = 250;
const WHITE_Y = 0.9;

type Rgb = [number, number, number];

/** `light` and `mark` are full-frame RGBA of the same `width`; `mark` is unpremultiplied (getImageData). */
export function markContrast(light: Uint8ClampedArray, mark: Uint8ClampedArray, width: number, logo: CardRect, url: CardRect): MarkContrast {
  const logoInk = inkOf(light, mark, width, logo);
  const urlInk = inkOf(light, mark, width, url);
  const backgroundMaxY = Math.max(logoInk.backgroundMaxY, urlInk.backgroundMaxY);
  const whiteY = Math.min(logoInk.whiteMinY, urlInk.whiteMinY);
  return {
    logoWhiteShare: logoInk.white / area(logo),
    logoAccentShare: logoInk.accent / area(logo),
    urlWhiteShare: urlInk.white / area(url),
    backgroundMaxY,
    textContrast: contrastRatio(whiteY, backgroundMaxY),
    accentContrast: logoInk.accent === 0 ? Number.POSITIVE_INFINITY : contrastRatio(logoInk.accentMinY, backgroundMaxY),
  };
}

interface RectInk {
  readonly white: number;
  readonly accent: number;
  readonly whiteMinY: number;
  readonly accentMinY: number;
  readonly backgroundMaxY: number;
}

function inkOf(light: Uint8ClampedArray, mark: Uint8ClampedArray, width: number, rect: CardRect): RectInk {
  const x0 = Math.round(rect.x);
  const y0 = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  const ink = grow(inkMask(mark, width, x0, y0, w, h), w, h);
  let white = 0;
  let accent = 0;
  let whiteMinY = 1;
  let accentMinY = 1;
  let backgroundMaxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const offset = ((y0 + y) * width + x0 + x) * 4;
      const luminance = relativeLuminance(composite(light, mark, offset));
      if (ink[y * w + x] !== 1) {
        backgroundMaxY = Math.max(backgroundMaxY, luminance);
        continue;
      }
      if ((mark[offset + 3] ?? 0) < OPAQUE) continue;
      if (luminance >= WHITE_Y) {
        white += 1;
        whiteMinY = Math.min(whiteMinY, luminance);
      } else if (isAccent(mark, offset)) {
        accent += 1;
        accentMinY = Math.min(accentMinY, luminance);
      }
    }
  }
  return { white, accent, whiteMinY, accentMinY, backgroundMaxY };
}

/** 1 where the mark's own colour is brighter than its glow. */
function inkMask(mark: Uint8ClampedArray, width: number, x0: number, y0: number, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const offset = ((y0 + y) * width + x0 + x) * 4;
      if ((mark[offset + 3] ?? 0) > 0 && relativeLuminance(rgbAt(mark, offset)) > INK_Y) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** The mask grown by INK_GROWTH px in every direction (a square neighbourhood). */
function grow(mask: Uint8Array, w: number, h: number): Uint8Array {
  const grown = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (mask[y * w + x] !== 1) continue;
      for (let dy = -INK_GROWTH; dy <= INK_GROWTH; dy += 1) {
        for (let dx = -INK_GROWTH; dx <= INK_GROWTH; dx += 1) {
          const gx = x + dx;
          const gy = y + dy;
          if (gx >= 0 && gx < w && gy >= 0 && gy < h) grown[gy * w + gx] = 1;
        }
      }
    }
  }
  return grown;
}

/** The lockup's orange (246, 93, 0): red well above green, little blue. */
function isAccent(mark: Uint8ClampedArray, offset: number): boolean {
  const [red, green, blue] = rgbAt(mark, offset);
  return red > green * 1.5 && blue < green;
}

/** Source-over in 8-bit sRGB, as the canvas composites the mark's layer over the light. */
function composite(light: Uint8ClampedArray, mark: Uint8ClampedArray, offset: number): Rgb {
  const alpha = (mark[offset + 3] ?? 0) / 255;
  const channel = (index: number) => Math.round(alpha * (mark[offset + index] ?? 0) + (1 - alpha) * (light[offset + index] ?? 0));
  return [channel(0), channel(1), channel(2)];
}

function rgbAt(data: Uint8ClampedArray, offset: number): Rgb {
  return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
}

function area(rect: CardRect): number {
  return Math.max(1, Math.round(rect.w) * Math.round(rect.h));
}
