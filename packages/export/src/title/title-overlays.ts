// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song's title in the video, drawn once on the page, where the bundled
// Jost and Hanken Grotesk are, and handed to the export worker as two bitmaps of the
// frame's size: the title card of the first 1.5 s and the caption after it. The worker
// only lays pixels over the light; it never draws text. No fallback font: a title in
// another face would make the file differ from the preview, so a missing font refuses.
import { brandLayout } from "../brand/brand-layout";
import type { CardContext } from "../brand/card";
import { drawTitleCaption } from "./title-caption";
import { TITLE_SIZES, detailFont, drawTitleCard, fitTitleLines, titleFont, type TitleUnits } from "./title-card";
import type { FrameSize } from "../probe/tiers";
/** Transparent but for the card or the caption, each the frame's size. */
export interface FrameTitle {
  readonly card: ImageBitmap;
  readonly caption: ImageBitmap;
}
export type TitleOverlaysResult =
  | { readonly ok: true; readonly overlays: FrameTitle }
  | { readonly ok: false; readonly reason: "font" };
export interface TitleOverlaysOptions {
  readonly fonts: Pick<FontFaceSet, "load" | "check">;
  readonly frame: FrameSize;
  /** The song's title, normalized. */
  readonly title: string;
  /** `132 BPM · c minor`, under the title on the card. */
  readonly detail: string;
}
/** Main thread: waits for and checks both faces, then draws the card and the caption. */
export async function prepareTitleOverlays(options: TitleOverlaysOptions): Promise<TitleOverlaysResult> {
  const layout = brandLayout(options.frame);
  const fonts = [...TITLE_SIZES.map((size) => titleFont(size.units, layout.scale)), detailFont(layout.scale)];
  try {
    await Promise.all(fonts.map((font) => options.fonts.load(font, options.title)));
  } catch {
    return { ok: false, reason: "font" };
  }
  if (!fonts.every((font) => options.fonts.check(font))) return { ok: false, reason: "font" };
  const card = drawn(options.frame, (ctx) => {
    const measure = (text: string, units: TitleUnits): number => {
      ctx.font = titleFont(units, layout.scale);
      ctx.letterSpacing = `${-0.01 * units * layout.scale}px`;
      const width = ctx.measureText(text).width / layout.scale;
      ctx.letterSpacing = "0px";
      return width;
    };
    drawTitleCard(ctx, layout, fitTitleLines(options.title, measure), options.detail);
  });
  const caption = drawn(options.frame, (ctx) => drawTitleCaption(ctx, layout, options.title));
  if (card === null || caption === null) {
    card?.close();
    caption?.close();
    return { ok: false, reason: "font" };
  }
  return { ok: true, overlays: { card, caption } };
}
function drawn(frame: FrameSize, paint: (ctx: CardContext) => void): ImageBitmap | null {
  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (ctx === null) return null;
  paint(ctx);
  return canvas.transferToImageBitmap();
}
