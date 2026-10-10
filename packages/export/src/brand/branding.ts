// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The attribution every video carries: the brand mark on each light frame and
// the closing card at the end, drawn once on the page, where the bundled font is, and
// transferred to the export worker as two bitmaps of the plan's frame size.
import { drawBrandMark } from "./brand-mark";
import { brandFont, brandLayout, type BrandLayout } from "./brand-layout";
import { drawClosingCard, type CardContext } from "./card";
import type { FrameSize } from "../probe/tiers";

declare const VIDEO_BRANDING: unique symbol;

/**
 * The drawn mark and card. The brand is not exported, so only prepareVideoBranding makes
 * one: a caller of ExportClient.start cannot hand in some other picture as the attribution.
 */
export interface VideoBranding {
  /** Transparent but for the scrim, the logo and the URL. */
  readonly mark: ImageBitmap;
  readonly card: ImageBitmap;
  readonly [VIDEO_BRANDING]: true;
}

export type BrandingResult =
  | { readonly ok: true; readonly branding: VideoBranding }
  | { readonly ok: false; readonly reason: "font" | "logo" };

function fontsOf(layout: BrandLayout): readonly string[] {
  return [layout.card.url.fontPx, layout.mark.url.fontPx].map(brandFont);
}

/** What the worker checks before it encodes an attribution it did not draw. */
export function isVideoFrameSize(bitmap: { readonly width: number; readonly height: number }, frame: FrameSize): boolean {
  return bitmap.width === frame.width && bitmap.height === frame.height;
}

/**
 * Main thread: waits for the bundled font, refuses to draw in a fallback font, decodes
 * the logo, and draws the mark and the card at the frame's size.
 */
export async function prepareVideoBranding(options: {
  readonly fonts: Pick<FontFaceSet, "load" | "check">;
  readonly logoUrl: string;
  readonly frame: FrameSize;
}): Promise<BrandingResult> {
  const layout = brandLayout(options.frame);
  const fonts = fontsOf(layout);
  try {
    await Promise.all(fonts.map((font) => options.fonts.load(font)));
  } catch {
    return { ok: false, reason: "font" };
  }
  if (!fonts.every((font) => options.fonts.check(font))) return { ok: false, reason: "font" };
  let logo: ImageBitmap;
  try {
    const response = await fetch(options.logoUrl);
    logo = await createImageBitmap(await response.blob());
  } catch {
    return { ok: false, reason: "logo" };
  }
  const mark = drawn(options.frame, true, (ctx) => drawBrandMark(ctx, logo, layout));
  const card = drawn(options.frame, false, (ctx) => drawClosingCard(ctx, logo, layout));
  logo.close();
  if (mark === null || card === null) return { ok: false, reason: "logo" };
  return { ok: true, branding: { mark, card } as VideoBranding };
}

function drawn(frame: FrameSize, alpha: boolean, paint: (ctx: CardContext) => void): ImageBitmap | null {
  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d", { alpha });
  if (ctx === null) return null;
  paint(ctx);
  return canvas.transferToImageBitmap();
}
