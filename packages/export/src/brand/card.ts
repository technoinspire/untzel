// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The closing card of every exported video: 2 s of the Techno Inspire | Untzel logo and
// the Untzel URL (no "Made with" line: the logo says it), required by the CPAL attribution.
// It fades in from the last light frame in 300 ms, or appears at
// once with reduced motion. Nothing here can leave a part out: drawClosingCard has no
// option, and the test-only variant lives behind ./testing. Positions come from
// brandLayout, for every frame size; the constants below are the 1080 × 1920 reference.
import { REFERENCE_SIZE, brandFont, brandLayout, type BrandLayout, type CardRect } from "./brand-layout";
import { FPS } from "../plan";

export type { CardRect } from "./brand-layout";

const REFERENCE = brandLayout(REFERENCE_SIZE);
export const CARD_URL = "untzel.com";
export const CARD_BACKGROUND = "#0B0B0C";
export const CARD_TEXT = "#FFFFFF";
export const CARD_FONT = brandFont(REFERENCE.card.url.fontPx);
export const LOGO_RECT: CardRect = REFERENCE.card.logo;
export const URL_RECT: CardRect = REFERENCE.card.url.rect;
export const URL_BASELINE = REFERENCE.card.url.baseline;
/** In the MP4 metadata as well. */
export const ATTRIBUTION_COMMENT = "Powered by Untzel · Techno Inspire · https://untzel.com";
/** 300 ms at 30 fps: the fade from the last light frame into the card. */
export const CARD_FADE_FRAMES = Math.round(0.3 * FPS);

/** The card and the mark are drawn on an OffscreenCanvas only: a name the worker lib has too. */
export type CardContext = OffscreenCanvasRenderingContext2D;
export type CardPart = "logo" | "url";

/** Draws the whole card on a context of the layout's frame size. */
export function drawClosingCard(ctx: CardContext, logo: CanvasImageSource, layout: BrandLayout): void {
  drawCard(ctx, logo, layout, null);
}

/** Exported by @untzel/export/testing only: the negative controls of the card test. */
export function drawCard(ctx: CardContext, logo: CanvasImageSource, layout: BrandLayout, omit: CardPart | null): void {
  const { card, centerX, size } = layout;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = CARD_BACKGROUND;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.fillStyle = CARD_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (omit !== "logo") ctx.drawImage(logo, card.logo.x, card.logo.y, card.logo.w, card.logo.h);
  if (omit !== "url") {
    ctx.font = brandFont(card.url.fontPx);
    ctx.fillText(CARD_URL, centerX, card.url.baseline);
  }
  ctx.restore();
}

/**
 * How much of the card covers the last light frame, `frame` frames into the card: an
 * exponential ease-out that is whole on the last of the 300 ms, or whole at once.
 */
export function cardFadeAlpha(frame: number, reducedMotion: boolean): number {
  if (reducedMotion || frame >= CARD_FADE_FRAMES - 1) return 1;
  return 1 - 2 ** ((-10 * (frame + 1)) / CARD_FADE_FRAMES);
}

/** A centered line's ink box as measureText reports it, for the tests that it fits its rect. */
export function measureTextBox(ctx: CardContext, text: string, font: string, baseline: number, centerX = REFERENCE.centerX): CardRect {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  ctx.restore();
  return {
    x: centerX - metrics.actualBoundingBoxLeft,
    y: baseline - metrics.actualBoundingBoxAscent,
    w: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
    h: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  };
}

/** The URL's ink box, for the test that it fits URL_RECT. */
export function measureUrlBox(ctx: CardContext): CardRect {
  return measureTextBox(ctx, CARD_URL, CARD_FONT, URL_BASELINE);
}
