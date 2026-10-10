// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: the song's title in a decoded video. The card and the
// caption are drawn alone over black with the page's own prepareTitleOverlays, which says
// which pixels are text and which are pill; in a frame that carries them the text is
// bright and the pill dark whatever the light does, like the brand mark (brand-check).
// Every whole card frame (before its exit) must carry the card and every light frame from
// 1.5 s on the caption; the caption's masks on a card frame, and the card's on a caption
// frame, are the negative controls.
import { TITLE_CARD_EXIT_VIDEO_FRAMES, TITLE_CARD_VIDEO_FRAMES, prepareTitleOverlays, type CardRect, type FrameSize } from "@untzel/export";
import { carriesMark, inkMasks, markScore, type InkMasks, type MarkScore } from "./brand-check";
import { markPixelsInRings } from "./mark-clearance";

/** What the export drew: the title and `132 BPM · c minor`. */
export interface TitleText {
  readonly text: string;
  readonly detail: string;
}

export interface TitleReferences {
  readonly card: InkMasks;
  readonly caption: InkMasks;
  /** Pixels of the caption (pill included) inside the rings' disc; 0 in the 16:9 corner. */
  readonly captionPixelsInRings: number;
}

export interface TitleFramesReport {
  readonly cardRect: CardRect;
  readonly captionRect: CardRect;
  readonly captionPixelsInRings: number;
  /** Whole card frames (before the exit) whose card failed the bright-ink or separation floor. */
  readonly framesWithoutCard: readonly number[];
  /** Light frames from TITLE_CARD_VIDEO_FRAMES on whose caption failed the floor. */
  readonly framesWithoutCaption: readonly number[];
  /** The caption's masks on the middle card frame: no caption there. */
  readonly captionControl: MarkScore | null;
  /** The card's masks on the middle caption frame: no card there. */
  readonly cardControl: MarkScore | null;
}

export async function titleReferences(size: FrameSize, title: TitleText): Promise<TitleReferences> {
  const prepared = await prepareTitleOverlays({ fonts: document.fonts, frame: size, title: title.text, detail: title.detail });
  if (!prepared.ok) throw new Error(`title overlays: ${prepared.reason}`);
  for (const overlay of [prepared.overlays.card, prepared.overlays.caption]) {
    if (overlay.width !== size.width || overlay.height !== size.height) throw new Error(`title overlay ${overlay.width}×${overlay.height}, frame ${size.width}×${size.height}`);
  }
  const cardOnBlack = overBlack(size, prepared.overlays.card);
  const captionOnBlack = overBlack(size, prepared.overlays.caption);
  prepared.overlays.card.close();
  prepared.overlays.caption.close();
  return {
    card: inkMasks(cardOnBlack, drawnBounds(cardOnBlack)),
    caption: inkMasks(captionOnBlack, drawnBounds(captionOnBlack)),
    captionPixelsInRings: markPixelsInRings(captionOnBlack),
  };
}

/** Scores each light frame as checkVideoFrames decodes it, then reports. */
export class TitleFramesCheck {
  readonly #references: TitleReferences;
  readonly #lightFrames: number;
  readonly #wholeCardFrames = TITLE_CARD_VIDEO_FRAMES - TITLE_CARD_EXIT_VIDEO_FRAMES;
  readonly #framesWithoutCard: number[] = [];
  readonly #framesWithoutCaption: number[] = [];
  #captionControl: MarkScore | null = null;
  #cardControl: MarkScore | null = null;

  constructor(references: TitleReferences, lightFrames: number) {
    this.#references = references;
    this.#lightFrames = lightFrames;
  }

  light(ctx: OffscreenCanvasRenderingContext2D, index: number): void {
    const { card, caption } = this.#references;
    if (index < this.#wholeCardFrames) {
      if (!carriesMark(scoreOn(ctx, card))) this.#framesWithoutCard.push(index);
      if (index === Math.floor(this.#wholeCardFrames / 2)) this.#captionControl = scoreOn(ctx, caption);
    } else if (index >= TITLE_CARD_VIDEO_FRAMES) {
      if (!carriesMark(scoreOn(ctx, caption))) this.#framesWithoutCaption.push(index);
      if (index === Math.floor((TITLE_CARD_VIDEO_FRAMES + this.#lightFrames) / 2)) this.#cardControl = scoreOn(ctx, card);
    }
  }

  report(): TitleFramesReport {
    return {
      cardRect: this.#references.card.rect,
      captionRect: this.#references.caption.rect,
      captionPixelsInRings: this.#references.captionPixelsInRings,
      framesWithoutCard: this.#framesWithoutCard,
      framesWithoutCaption: this.#framesWithoutCaption,
      captionControl: this.#captionControl,
      cardControl: this.#cardControl,
    };
  }
}

function scoreOn(ctx: OffscreenCanvasRenderingContext2D, masks: InkMasks): MarkScore {
  const { rect } = masks;
  return markScore(ctx.getImageData(rect.x, rect.y, rect.w, rect.h), masks);
}

function overBlack(size: FrameSize, overlay: ImageBitmap): ImageData {
  const ctx = new OffscreenCanvas(size.width, size.height).getContext("2d", { alpha: false, willReadFrequently: true });
  if (ctx === null) throw new Error("no 2D context");
  ctx.drawImage(overlay, 0, 0);
  return ctx.getImageData(0, 0, size.width, size.height);
}

/** The smallest rectangle around every pixel that is not black. */
export function drawnBounds(image: ImageData): CardRect {
  const { width, height, data } = image;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if ((data[offset] ?? 0) + (data[offset + 1] ?? 0) + (data[offset + 2] ?? 0) === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error("nothing drawn");
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
