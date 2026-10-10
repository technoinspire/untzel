// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: one pass over every decoded frame of an exported MP4. Light frames are
// scored for the brand mark (and the same masks off the mark, the negative control); the
// card frames after the fade are compared with the reference card per rectangle. Every
// rectangle comes from the file's own brandLayout, so a 16:9 or a 4K file is held to the
// same checks as the 1080 × 1920 story.
import { CARD_FADE_FRAMES, CARD_VIDEO_FRAMES, type BrandLayout, type CardRect } from "@untzel/export";
import { VideoSampleSink, type InputVideoTrack } from "mediabunny";
import { carriesMark, inkMasks, markScore, type InkMasks, type MarkScore } from "./brand-check";
import { TitleFramesCheck, type TitleFramesReport, type TitleReferences } from "./title-check";

/** The control masks sit this far above the mark (at 1080, times the layout's scale), on light without it. */
const CONTROL_SHIFT_Y = -700;
const MARK_SAMPLES = [0.1, 0.5, 0.9] as const;

export interface FrameReferences {
  readonly layout: BrandLayout;
  readonly card: ImageData;
  readonly noLogo: ImageData;
  readonly noUrl: ImageData;
  /** The brand mark alone over black. */
  readonly markOnBlack: ImageData;
}

export interface FrameCheck {
  readonly index: number;
  readonly logo: number;
  readonly url: number;
  readonly logoVsNoLogo: number;
  readonly urlVsNoUrl: number;
}

export interface MarkCheck {
  readonly index: number;
  /** Where in the light part: 0.1, 0.5 or 0.9. */
  readonly at: number;
  readonly logo: MarkScore;
  readonly url: MarkScore;
  readonly logoControl: MarkScore;
  readonly urlControl: MarkScore;
}

export interface VideoFramesReport {
  readonly lightFrames: number;
  readonly markChecks: readonly MarkCheck[];
  /** The lowest contrast of the mark over every light frame, and where. */
  readonly worstMarkContrast: { readonly index: number; readonly logo: number; readonly url: number };
  /** Light frames whose mark failed the bright-ink or separation floor. */
  readonly framesWithoutMark: readonly number[];
  readonly cardFrames: readonly FrameCheck[];
  /** The last light frame against the card's URL rectangle. */
  readonly lastLightFrameUrl: number;
  /** The song's title card and caption; null when the check was not asked for. */
  readonly title: TitleFramesReport | null;
}


export async function checkVideoFrames(video: InputVideoTrack, frames: number, references: FrameReferences, title: TitleReferences | null): Promise<VideoFramesReport> {
  const { layout } = references;
  const { width, height } = layout.size;
  const ctx = new OffscreenCanvas(width, height).getContext("2d", { alpha: false, willReadFrequently: true });
  if (ctx === null) throw new Error("no 2D context");
  const lightFrames = frames - CARD_VIDEO_FRAMES;
  const shift = CONTROL_SHIFT_Y * layout.scale;
  const sampled = new Map(MARK_SAMPLES.map((at) => [Math.floor(at * lightFrames), at]));
  const logoMasks = inkMasks(references.markOnBlack, layout.mark.logo);
  const urlMasks = inkMasks(references.markOnBlack, layout.mark.url.rect);
  const markChecks: MarkCheck[] = [];
  const cardFrames: FrameCheck[] = [];
  const framesWithoutMark: number[] = [];
  const titleCheck = title === null ? null : new TitleFramesCheck(title, lightFrames);
  let worst = { index: -1, logo: Number.POSITIVE_INFINITY, url: Number.POSITIVE_INFINITY };
  let lastLightFrameUrl = Number.NaN;
  let index = 0;
  for await (const sample of new VideoSampleSink(video).samples()) {
    sample.draw(ctx, 0, 0, width, height);
    sample.close();
    if (index < lightFrames) {
      const logo = scoreAt(ctx, logoMasks, 0);
      const url = scoreAt(ctx, urlMasks, 0);
      if (!carriesMark(logo) || !carriesMark(url)) framesWithoutMark.push(index);
      titleCheck?.light(ctx, index);
      if (Math.min(logo.contrast, url.contrast) < Math.min(worst.logo, worst.url)) worst = { index, logo: logo.contrast, url: url.contrast };
      const at = sampled.get(index);
      if (at !== undefined) {
        markChecks.push({ index, at, logo, url, logoControl: scoreAt(ctx, logoMasks, shift), urlControl: scoreAt(ctx, urlMasks, shift) });
      }
      if (index === lightFrames - 1) lastLightFrameUrl = meanError(ctx.getImageData(0, 0, width, height), references.card, layout.card.url.rect);
    } else if (index - lightFrames >= CARD_FADE_FRAMES - 1) {
      cardFrames.push(cardCheck(index, ctx.getImageData(0, 0, width, height), references));
    }
    index += 1;
  }
  return { lightFrames, markChecks, worstMarkContrast: worst, framesWithoutMark, cardFrames, lastLightFrameUrl, title: titleCheck?.report() ?? null };
}

function scoreAt(ctx: OffscreenCanvasRenderingContext2D, masks: InkMasks, shiftY: number): MarkScore {
  const { rect } = masks;
  return markScore(ctx.getImageData(rect.x, rect.y + shiftY, rect.w, rect.h), masks);
}

function cardCheck(index: number, pixels: ImageData, references: FrameReferences): FrameCheck {
  const { card } = references.layout;
  return {
    index,
    logo: meanError(pixels, references.card, card.logo),
    url: meanError(pixels, references.card, card.url.rect),
    logoVsNoLogo: meanError(pixels, references.noLogo, card.logo),
    urlVsNoUrl: meanError(pixels, references.noUrl, card.url.rect),
  };
}

/** Mean absolute error per channel (RGB) inside a rectangle, in 1/255. */
export function meanError(a: ImageData, b: ImageData, rect: CardRect): number {
  let sum = 0;
  let count = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const offset = (y * a.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        sum += Math.abs((a.data[offset + channel] ?? 0) - (b.data[offset + channel] ?? 0));
        count += 1;
      }
    }
  }
  return sum / count;
}
