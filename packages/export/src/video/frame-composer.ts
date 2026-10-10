// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Each encoded frame of a story or video: the light with the brand mark laid over it,
// then the closing card, faded in from the last light frame (cardFadeAlpha). Worker only:
// OffscreenCanvas 2D, at the plan's frame size. There is no path to a light frame without
// the mark. The song's title goes over the light after the mark: the
// title card below TITLE_CARD_VIDEO_FRAMES, fading out at its end, then the caption; never
// both on one frame, and never under the mark.
import { cardFadeAlpha } from "../brand/card";
import { TITLE_CARD_VIDEO_FRAMES } from "../plan";
import { titleCardOpacity } from "../title/title-card";
import type { FrameTitle } from "../title/title-overlays";
import type { FrameSize } from "../probe/tiers";

export interface FrameBranding {
  /** prepareVideoBranding's mark and card, the frame's size. */
  readonly mark: ImageBitmap;
  readonly card: ImageBitmap;
}

export interface FrameComposerOptions {
  readonly frame: FrameSize;
  readonly branding: FrameBranding;
  readonly reducedMotion: boolean;
  /** prepareTitleOverlays' card and caption, the frame's size; null without a title (tests). */
  readonly title: FrameTitle | null;
}

export class FrameComposer {
  readonly #mark: ImageBitmap;
  readonly #card: ImageBitmap;
  readonly #title: FrameTitle | null;
  readonly #reducedMotion: boolean;
  readonly #size: FrameSize;
  readonly #frame: OffscreenCanvas;
  readonly #ctx: OffscreenCanvasRenderingContext2D;
  /** The last light frame, under the card while it fades in. */
  readonly #held: OffscreenCanvas;
  readonly #heldCtx: OffscreenCanvasRenderingContext2D;

  constructor(options: FrameComposerOptions) {
    this.#mark = options.branding.mark;
    this.#card = options.branding.card;
    this.#title = options.title;
    this.#reducedMotion = options.reducedMotion;
    this.#size = options.frame;
    this.#frame = new OffscreenCanvas(options.frame.width, options.frame.height);
    this.#held = new OffscreenCanvas(options.frame.width, options.frame.height);
    this.#ctx = context(this.#frame);
    this.#heldCtx = context(this.#held);
  }

  /** Light frame `frame` as the stage drew it, the mark on top, then the title card or caption. */
  light(stage: OffscreenCanvas, frame: number): OffscreenCanvas {
    const ctx = this.#ctx;
    ctx.globalAlpha = 1;
    ctx.drawImage(stage, 0, 0, this.#size.width, this.#size.height);
    ctx.drawImage(this.#mark, 0, 0);
    if (this.#title === null) return this.#frame;
    if (frame < TITLE_CARD_VIDEO_FRAMES) {
      ctx.globalAlpha = titleCardOpacity(frame, this.#reducedMotion);
      ctx.drawImage(this.#title.card, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(this.#title.caption, 0, 0);
    }
    return this.#frame;
  }

  /** Frame `index` of the card; the first ones blend over the last light frame. */
  card(index: number): CanvasImageSource {
    const alpha = cardFadeAlpha(index, this.#reducedMotion);
    if (alpha === 1) return this.#card;
    if (index === 0) this.#heldCtx.drawImage(this.#frame, 0, 0);
    this.#ctx.globalAlpha = 1;
    this.#ctx.drawImage(this.#held, 0, 0);
    this.#ctx.globalAlpha = alpha;
    this.#ctx.drawImage(this.#card, 0, 0);
    this.#ctx.globalAlpha = 1;
    return this.#frame;
  }
}

function context(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (ctx === null) throw new Error("export: no 2D context to compose the frames");
  return ctx;
}
