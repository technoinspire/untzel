// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// @untzel/scene/palette: the 8 track colours. OKLCH with equal lightness and
// equal chroma, hues 45° apart, slot 0 on the flare's hue, so any combination harmonises;
// a section turns all eight together by at most ±12°, and a track's colour never changes
// on its own. C 0.12 is the largest chroma every hue keeps inside sRGB at every turn.

export const TRACK_PALETTE_SIZE = 8;
export const PALETTE_LIGHTNESS = 0.76;
export const PALETTE_CHROMA = 0.12;
/** The hue of flare #F65D00 in OKLCH. */
export const FIRST_HUE_DEGREES = 42;
export const HUE_STEP_DEGREES = 360 / TRACK_PALETTE_SIZE;
/** Under a third of the step, so neighbouring slots never meet. */
export const MAX_SECTION_SHIFT_DEGREES = 12;

/** sRGB, each channel 0..1 (gamma encoded). */
export interface SrgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function oklchToLinearSrgb(lightness: number, chroma: number, hueDegrees: number): readonly [number, number, number] {
  const a = chroma * Math.cos((hueDegrees * Math.PI) / 180);
  const b = chroma * Math.sin((hueDegrees * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function encodeSrgb(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** The 8 colours turned together by `shiftDegrees` (clamped to ±12), rounded to 8 bits. */
export function paletteAt(shiftDegrees: number): readonly SrgbColor[] {
  const shift = Math.min(MAX_SECTION_SHIFT_DEGREES, Math.max(-MAX_SECTION_SHIFT_DEGREES, Number.isFinite(shiftDegrees) ? shiftDegrees : 0));
  return Array.from({ length: TRACK_PALETTE_SIZE }, (_, slot) => {
    const [r, g, b] = oklchToLinearSrgb(PALETTE_LIGHTNESS, PALETTE_CHROMA, FIRST_HUE_DEGREES + slot * HUE_STEP_DEGREES + shift);
    const byte = (channel: number): number => Math.round(encodeSrgb(channel) * 255) / 255;
    return { r: byte(r), g: byte(g), b: byte(b) };
  });
}

export function toHex(color: SrgbColor): string {
  const hex = (channel: number): string => Math.round(channel * 255).toString(16).padStart(2, "0");
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`.toUpperCase();
}
