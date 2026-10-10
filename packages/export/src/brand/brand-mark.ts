// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The brand mark on every light frame of a story or video (the CPAL
// attribution): the white Techno Inspire logo and, half a logo below it, the
// Untzel URL, over a soft dark glow with no edge (no black box). In the story it sits in the lower third and above the bottom 20 % that Instagram
// covers with its own interface (the top 14 % is covered too); in a landscape frame, in
// the safe area's lower-right corner (brandLayout). It has no option and no off switch. The mark
// is static, so it adds no change of luminance from one frame to the next: the flash
// limiter's bound on the light holds on the composited frame. Positions come from
// brandLayout, for every frame size; the constants below are the 1080 × 1920 reference.
import { REFERENCE_SIZE, brandFont, brandLayout, type BrandLayout, type CardRect, type RingsClearance } from "./brand-layout";
import { CARD_URL, type CardContext } from "./card";

const REFERENCE = brandLayout(REFERENCE_SIZE);
/** The top band Instagram's own interface covers, as a share of any frame's height. */
export const SAFE_TOP_SHARE = 0.14;
/** Instagram's own interface covers these bands of a 1920 px story. */
export const SAFE_TOP = Math.round(REFERENCE_SIZE.height * SAFE_TOP_SHARE);
export const SAFE_BOTTOM = Math.round(REFERENCE_SIZE.height * 0.8);
/** The lower third starts here. */
export const LOWER_THIRD_TOP = Math.round((REFERENCE_SIZE.height * 2) / 3);

export const MARK_LOGO_RECT: CardRect = REFERENCE.mark.logo;
export const MARK_URL_FONT = brandFont(REFERENCE.mark.url.fontPx);
export const MARK_URL_BASELINE = REFERENCE.mark.url.baseline;
export const MARK_URL_RECT: CardRect = REFERENCE.mark.url.rect;
export const MARK_SCRIM_RECT: CardRect = REFERENCE.mark.scrim;
export const MARK_SCRIM_RADIUS = REFERENCE.mark.scrimRadius;
/** CARD_BACKGROUND at this opacity under all of the mark's ink: ≥ 4.5:1 for white even over a white frame. */
export const MARK_SCRIM_ALPHA = 0.6;
/**
 * The glow is an ellipse GLOW_SPAN times the zone, at full strength out to GLOW_SOLID of
 * its radius and gone at its edge. Every corner of the logo and the URL lies inside the
 * solid part (at most 0.64 of the radius), so the worst-case contrast holds; the fade
 * leaves no visible edge. The sheet's preview draws the same glow (export-preview.css).
 * In the 16:9 corner the ellipse's upper-left tip would reach 73 px into the rings' disc
 * (12 317 px at HD, measured 05/10/2026) and dim their lower-right arc: it is erased there
 * (RingsClearance), and every corner of the logo and the URL stays outside the cut.
 */
export const GLOW_SPAN = { x: 1.8, y: 1.6 } as const;
export const GLOW_SOLID = 0.75;
const SHADOW_PX = 10;
const SCRIM_RGB = [11, 11, 12] as const;
/** The scrim's paint: the title card and caption sit on the same one, for the same worst case. */
export const MARK_SCRIM_FILL = `rgba(${SCRIM_RGB.join(", ")}, ${MARK_SCRIM_ALPHA})`;
export const MARK_TEXT = "#FFFFFF";

/** Draws the mark alone on a transparent context of the layout's frame size, to lay over each frame. */
export function drawBrandMark(ctx: CardContext, logo: CanvasImageSource, layout: BrandLayout): void {
  const { mark, size } = layout;
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  drawGlow(ctx, mark.scrim);
  if (mark.ringsClearance !== null) clearRings(ctx, mark.ringsClearance);
  ctx.shadowColor = `rgba(${SCRIM_RGB.join(", ")}, 0.6)`;
  ctx.shadowBlur = SHADOW_PX * layout.scale;
  ctx.drawImage(logo, mark.logo.x, mark.logo.y, mark.logo.w, mark.logo.h);
  ctx.font = brandFont(mark.url.fontPx);
  ctx.fillStyle = MARK_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(CARD_URL, mark.centerX, mark.url.baseline);
  ctx.restore();
}

/** A soft elliptical darkening centred on the zone: no edge, so it never reads as a box. */
function drawGlow(ctx: CardContext, zone: CardRect): void {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const rx = (zone.w * GLOW_SPAN.x) / 2;
  const ry = (zone.h * GLOW_SPAN.y) / 2;
  const colour = (alpha: number) => `rgba(${SCRIM_RGB.join(", ")}, ${alpha})`;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  glow.addColorStop(0, colour(MARK_SCRIM_ALPHA));
  glow.addColorStop(GLOW_SOLID, colour(MARK_SCRIM_ALPHA));
  glow.addColorStop(1, colour(0));
  ctx.fillStyle = glow;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Erases the glow drawn so far inside the rings' disc, with a soft edge just outside it. */
function clearRings(ctx: CardContext, clearance: RingsClearance): void {
  const { centerX, centerY, inner, outer } = clearance;
  const cut = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outer);
  cut.addColorStop(0, "rgba(0, 0, 0, 1)");
  cut.addColorStop(inner / outer, "rgba(0, 0, 0, 1)");
  cut.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = cut;
  ctx.beginPath();
  ctx.arc(centerX, centerY, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
/** WCAG relative luminance of an sRGB colour, channels 0..255. */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(lighter: number, darker: number): number {
  return (Math.max(lighter, darker) + 0.05) / (Math.min(lighter, darker) + 0.05);
}

/** The scrim over a frame of this colour, composited as the canvas does (in sRGB). */
export function scrimOver(background: readonly [number, number, number]): [number, number, number] {
  const mix = (index: 0 | 1 | 2) => MARK_SCRIM_ALPHA * SCRIM_RGB[index] + (1 - MARK_SCRIM_ALPHA) * background[index];
  return [mix(0), mix(1), mix(2)];
}

/** White mark on the scrim over the brightest possible frame, pure white: the worst case. */
export function worstCaseMarkContrast(): number {
  return contrastRatio(1, relativeLuminance(scrimOver([255, 255, 255])));
}
