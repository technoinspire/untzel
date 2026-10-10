// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { paletteAt } from "@untzel/scene/palette";
import { isSaturatedRed, linearChannel, type FrameLuminance } from "./flash-limiter";
import { FIGURE_GAIN } from "./post-light";
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import type { SkyAtmosphere } from "../composer/sky-atmosphere";
// The mean relative luminance of a composition, estimated on the CPU from its primitives so
// the limiter runs before drawing (no GPU read-back). Measured in the composition square
// (4 u²), the same in every format: intensity × colour luminance × the area the primitive
// lights.

const SQUARE_AREA = 4;
const SQUARE_WIDTH = 2;
/** Linear sRGB of the 8 slots; the section's turn keeps L and C, so the luminance barely moves. */
const SLOTS = paletteAt(0).map((color) => [linearChannel(color.r * 255), linearChannel(color.g * 255), linearChannel(color.b * 255)] as const);

function slotRgb(primitive: ScenePrimitive): readonly [number, number, number] {
  return SLOTS[primitive.color] ?? SLOTS[0] ?? [1, 1, 1];
}

/** u² the primitive lights inside the square (its glow halo included for figures). */
export function coverage(primitive: ScenePrimitive): number {
  const { size, width, aspect } = primitive;
  const stroke = Math.max(width, 0.004) * 3;
  if (primitive.layer === "area") {
    switch (primitive.kind) {
      case AreaKind.Glow:
        return Math.PI * size * size * aspect * 0.55;
      case AreaKind.Cloud:
        return Math.PI * size * size * aspect * 0.7;
      case AreaKind.Band:
        return SQUARE_WIDTH * size * 2 * 0.8;
      case AreaKind.Rise:
        return SQUARE_WIDTH * (size + aspect) * 0.4;
    }
  }
  switch (primitive.kind) {
    case FigureKind.Ring:
      return 2 * Math.PI * size * stroke * (primitive.extra === 1 ? 0.5 : 1);
    case FigureKind.Arcs:
      return 2 * Math.PI * size * stroke * 0.6;
    case FigureKind.Shards:
      return primitive.extra * size * (1 - aspect) * stroke;
    case FigureKind.Ellipse:
      return Math.PI * size * (1 + aspect) * stroke;
    case FigureKind.Dot:
      return Math.PI * (size + stroke) ** 2;
    case FigureKind.Bar:
      return 4 * (size + stroke) * (size * aspect + stroke);
    case FigureKind.Line:
    case FigureKind.Comb:
      return SQUARE_WIDTH * (stroke + size * 0.2);
    default:
      return 4 * size * stroke;
  }
}

/**
 * The share of a frame the sky's haze may light: the band above the chrome line is 28 % of a
 * story frame and 14 % of a 16:9 one. Counted at full level in every frame, the page's
 * included, so the screen and the file get the same gain and the video stays the screen.
 */
export const SKY_HAZE_SHARE = 0.3;

/** The primitives plus the sky's haze: its level is base light, its breath transient. */
export function frameLuminance(frame: { readonly primitives: readonly ScenePrimitive[]; readonly sky: SkyAtmosphere }, time: number): FrameLuminance {
  const scene = compositionLuminance(frame.primitives, time);
  const { sky } = frame;
  if (sky.level <= 0) return scene;
  const [r, g, b] = SLOTS[sky.color] ?? SLOTS[0] ?? [1, 1, 1];
  const haze = sky.level * (0.2126 * r + 0.7152 * g + 0.0722 * b) * SKY_HAZE_SHARE;
  return { ...scene, base: Math.min(1, scene.base + haze), transient: Math.min(1, scene.transient + haze * sky.breath) };
}

export function compositionLuminance(primitives: readonly ScenePrimitive[], time: number): FrameLuminance {
  let base = 0;
  let transient = 0;
  const weighted = [0, 0, 0];
  for (const primitive of primitives) {
    const [r, g, b] = primitive.whiteCore ? [1, 1, 1] : slotRgb(primitive);
    const lit = Math.min(SQUARE_AREA, coverage(primitive)) / SQUARE_AREA;
    // The figure's gain counted on its whole coverage, halo included: an over-estimate, so
    // the limiter errs towards calm.
    const gain = primitive.layer === "figure" ? FIGURE_GAIN : 1;
    const light = primitive.intensity * gain * (0.2126 * r + 0.7152 * g + 0.0722 * b) * lit;
    if (!primitive.isTransient) {
      base += light;
      continue;
    }
    transient += light;
    weighted[0] = (weighted[0] ?? 0) + r * light;
    weighted[1] = (weighted[1] ?? 0) + g * light;
    weighted[2] = (weighted[2] ?? 0) + b * light;
  }
  return {
    time,
    base: Math.min(1, base),
    transient: Math.min(1, transient),
    isSaturatedRed: transient > 0 && isSaturatedRed((weighted[0] ?? 0) * 255, (weighted[1] ?? 0) * 255, (weighted[2] ?? 0) * 255),
  };
}
