// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song's title card over the first 1.5 s of light: the title in
// Jost 500 and `132 BPM · c minor` under it, on the mark's scrim, on the frame's centre
// line and centred between Instagram's top band and the mark's scrim. Every length is in
// units of 1080 on the shorter side, like brandLayout. The geometry and the line fitting
// are pure; drawTitleCard runs on the page only, where the bundled fonts are.
import type { BrandLayout, CardRect } from "../brand/brand-layout";
import { MARK_SCRIM_FILL, MARK_TEXT, SAFE_TOP_SHARE } from "../brand/brand-mark";
import type { CardContext } from "../brand/card";
import { TITLE_CARD_EXIT_VIDEO_FRAMES, TITLE_CARD_VIDEO_FRAMES } from "../plan";
import type { FrameSize } from "../probe/tiers";
/** The title's sizes, largest first, and how many lines each may take. */
export const TITLE_SIZES = [
  { units: 96, maxLines: 2 },
  { units: 72, maxLines: 3 },
] as const;
export type TitleUnits = (typeof TITLE_SIZES)[number]["units"];
export const TITLE_CARD_WIDTH = 900;
export const TITLE_CARD_RADIUS = 40;
const PADDING_TOP = 64;
const PADDING_BOTTOM = 60;
const PADDING_SIDE = 48;
const DETAIL_GAP = 24;
const DETAIL_LINE = 48;
export const DETAIL_UNITS = 40;
/** The title's line box: the room the text has inside the card. */
export const TITLE_LINE_WIDTH = TITLE_CARD_WIDTH - 2 * PADDING_SIDE;
const ELLIPSIS = "…";
/** Width of `text` at a size, in units; the page measures with the real font. */
export type MeasureText = (text: string, units: TitleUnits) => number;
export interface FittedTitle {
  readonly units: TitleUnits;
  readonly lines: readonly string[];
}
/** The top band Instagram covers, a share of the height (269 in a 1920 story, 151 at 1080 high). */
export function topBand(size: FrameSize): number {
  return Math.round(size.height * SAFE_TOP_SHARE);
}
export function lineAdvance(units: number): number {
  return Math.round(units * 1.08);
}
/** The card's height in units: 300 for one line at 96, 352 for two at 72, 430 for three. */
export function titleCardHeight(lineCount: number, titleUnits: number): number {
  return PADDING_TOP + lineCount * lineAdvance(titleUnits) + DETAIL_GAP + DETAIL_LINE + PADDING_BOTTOM;
}
/** On the frame's centre line, centred between the top band and the mark's scrim. */
export function titleCardRect(layout: BrandLayout, size: FrameSize, cardHeightUnits: number): CardRect {
  const h = cardHeightUnits * layout.scale;
  const top = topBand(size);
  const w = TITLE_CARD_WIDTH * layout.scale;
  return {
    x: Math.round(layout.centerX - w / 2),
    y: Math.round(top + (layout.mark.scrim.y - top - h) / 2),
    w,
    h,
  };
}
/** Greedy breaks between words; null when a word alone is wider than the line or lines run out. */
function breakLines(words: readonly string[], fits: (line: string) => boolean, maxLines: number): string[] | null {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && fits(`${last} ${word}`)) lines[lines.length - 1] = `${last} ${word}`;
    else if (fits(word)) lines.push(word);
    else return null;
    if (lines.length > maxLines) return null;
  }
  return lines;
}
/** `text` when it fits, else its longest start that fits with an ellipsis after it. */
export function withEllipsis(text: string, fits: (line: string) => boolean): string {
  if (fits(text)) return text;
  const points = [...text];
  for (let count = points.length; count > 0; count -= 1) {
    const candidate = `${points.slice(0, count).join("").trimEnd()}${ELLIPSIS}`;
    if (fits(candidate)) return candidate;
  }
  return ELLIPSIS;
}
/**
 * 96 up to two lines; else 72 up to three; else three lines at 72, the last one cut with
 * an ellipsis. Breaks only between words (hyphens: manual).
 */
export function fitTitleLines(title: string, measure: MeasureText): FittedTitle {
  const words = title.split(" ").filter((word) => word !== "");
  for (const { units, maxLines } of TITLE_SIZES) {
    const lines = breakLines(words, (line) => measure(line, units) <= TITLE_LINE_WIDTH, maxLines);
    if (lines !== null) return { units, lines };
  }
  const smallest = TITLE_SIZES[1];
  const fits = (line: string) => measure(line, smallest.units) <= TITLE_LINE_WIDTH;
  return { units: smallest.units, lines: ellipsizedLines(words, fits, smallest.maxLines) };
}
/** Greedy lines where a word too wide is cut, and the last line takes the rest with an ellipsis. */
function ellipsizedLines(words: readonly string[], fits: (line: string) => boolean, maxLines: number): string[] {
  const lines: string[] = [];
  for (const [index, word] of words.entries()) {
    const last = lines.at(-1);
    if (last !== undefined && fits(`${last} ${word}`)) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else if (lines.length === maxLines) {
      lines[maxLines - 1] = withEllipsis(`${last ?? ""} ${words.slice(index).join(" ")}`, fits);
      return lines;
    } else {
      lines.push(fits(word) ? word : withEllipsis(word, fits));
    }
  }
  return lines;
}
/**
 * The card's opacity at a light frame below TITLE_CARD_VIDEO_FRAMES: whole until the exit
 * starts, then an exponential ease out to nearly 0 at the last card frame. With reduced
 * motion it stays whole and the caption replaces it at once.
 */
export function titleCardOpacity(frame: number, isReducedMotion: boolean): number {
  const exitStart = TITLE_CARD_VIDEO_FRAMES - TITLE_CARD_EXIT_VIDEO_FRAMES;
  if (isReducedMotion || frame < exitStart) return 1;
  const t = (frame - exitStart) / TITLE_CARD_EXIT_VIDEO_FRAMES;
  return 1 - (1 - 2 ** (-10 * t)) / (1 - 2 ** -10);
}
export function titleFont(units: number, scale: number): string {
  return `500 ${units * scale}px Jost`;
}
export function detailFont(scale: number): string {
  return `600 ${DETAIL_UNITS * scale}px 'Hanken Grotesk'`;
}
/** Draws the card alone on a transparent context of the frame's size. */
export function drawTitleCard(ctx: CardContext, layout: BrandLayout, title: FittedTitle, detail: string): void {
  const { scale, size } = layout;
  const rect = titleCardRect(layout, size, titleCardHeight(title.lines.length, title.units));
  const advance = lineAdvance(title.units) * scale;
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = MARK_SCRIM_FILL;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, TITLE_CARD_RADIUS * scale);
  ctx.fill();
  ctx.fillStyle = MARK_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = titleFont(title.units, scale);
  ctx.letterSpacing = `${-0.01 * title.units * scale}px`;
  const centerX = layout.centerX;
  let lineTop = rect.y + PADDING_TOP * scale;
  for (const line of title.lines) {
    ctx.fillText(line, centerX, lineTop + advance / 2);
    lineTop += advance;
  }
  ctx.letterSpacing = "0px";
  ctx.font = detailFont(scale);
  ctx.fillText(detail, centerX, lineTop + (DETAIL_GAP + DETAIL_LINE / 2) * scale);
  ctx.restore();
}
