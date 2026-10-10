// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song's caption from 1.5 s to the closing card: the title in
// Hanken Grotesk 600 at 40 on a 76-unit pill of the mark's scrim, on the mark's own axis
// and 16 units above its scrim, so it never covers the mark. In the 16:9 corner it is at
// most 400 wide, which keeps it inside the safe area and off the rings' disc. The
// geometry is pure; drawTitleCaption runs on the page only.
import type { BrandLayout, CardRect, MarkPlacement } from "../brand/brand-layout";
import { MARK_SCRIM_FILL, MARK_TEXT } from "../brand/brand-mark";
import type { CardContext } from "../brand/card";
import { detailFont, withEllipsis } from "./title-card";
/** The widest pill, in units, per mark placement. */
export const CAPTION_MAX_WIDTH: Readonly<Record<MarkPlacement, number>> = { centred: 840, corner: 400 };
const CAPTION_HEIGHT = 76;
const CAPTION_PADDING = 36;
/** From the pill's bottom to the mark scrim's top. */
const CAPTION_GAP = 16;
/** The pill for a title `textWidth` pixels wide, clamped to the placement's widest. */
export function captionRect(layout: BrandLayout, textWidth: number): CardRect {
  const { mark, scale } = layout;
  const w = Math.min(textWidth + 2 * CAPTION_PADDING * scale, CAPTION_MAX_WIDTH[mark.placement] * scale);
  return {
    x: Math.round(mark.centerX - w / 2),
    y: mark.scrim.y - (CAPTION_GAP + CAPTION_HEIGHT) * scale,
    w,
    h: CAPTION_HEIGHT * scale,
  };
}
/** The room the text has inside the widest pill, in pixels. */
export function captionTextWidth(layout: BrandLayout): number {
  return (CAPTION_MAX_WIDTH[layout.mark.placement] - 2 * CAPTION_PADDING) * layout.scale;
}
/** Draws the caption alone on a transparent context of the frame's size; one line, ellipsis. */
export function drawTitleCaption(ctx: CardContext, layout: BrandLayout, title: string): void {
  const { scale, size } = layout;
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.font = detailFont(scale);
  const room = captionTextWidth(layout);
  const text = withEllipsis(title, (line) => ctx.measureText(line).width <= room);
  const rect = captionRect(layout, ctx.measureText(text).width);
  ctx.fillStyle = MARK_SCRIM_FILL;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, (CAPTION_HEIGHT / 2) * scale);
  ctx.fill();
  ctx.fillStyle = MARK_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, layout.mark.centerX, rect.y + rect.h / 2);
  ctx.restore();
}
