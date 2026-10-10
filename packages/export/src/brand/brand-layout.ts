// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the brand mark and the closing card sit on a frame of any size. The
// reference is the 1080 × 1920 story. Every length is
// multiplied by shorter side / 1080, so a 4K frame carries the same mark at twice the
// pixels, never a smaller one. The mark's place is per format and the light is never
// recomposed for it: under the rings in a portrait frame (the story's anchors, fractions
// of the height), and in the safe area's lower-right corner of a landscape frame, where
// the rings, scaled by the shorter side, leave room. Pure:
// the page draws with it, the export lab measures with it, the sheet's preview places its
// parts with it.
import { DESIGN_RADIUS, SAFE_MARGIN, fitScene } from "@untzel/light/offline";
import type { FrameSize } from "../probe/tiers";

export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TextLine {
  /** The line's box with room to spare; the browser test checks the ink fits. */
  readonly rect: CardRect;
  readonly baseline: number;
  readonly fontPx: number;
}

/**
 * The rings' disc the corner glow stays out of (nothing of the mark or its glow inside it). drawBrandMark erases the glow fully within `inner` and
 * fades it back to full strength at `outer`; the sheet's preview masks it the same way.
 * Frame pixels, about the frame's centre.
 */
export interface RingsClearance {
  readonly centerX: number;
  readonly centerY: number;
  /** The rings' design radius plus a 2 px margin: no glow inside. */
  readonly inner: number;
  /** Where the glow is whole again: inside the logo's nearest corner, so its glow is untouched. */
  readonly outer: number;
}
/** "centred": under the rings, on the frame's centre line; "corner": the safe area's lower right. */
export type MarkPlacement = "centred" | "corner";

export interface BrandLayout {
  readonly size: FrameSize;
  /** shorter side / 1080. */
  readonly scale: number;
  /** The frame's centre line: the closing card's axis. */
  readonly centerX: number;
  readonly mark: {
    readonly placement: MarkPlacement;
    /** The mark's own axis: the URL is centred on it. */
    readonly centerX: number;
    readonly scrim: CardRect;
    readonly scrimRadius: number;
    readonly logo: CardRect;
    readonly url: TextLine;
    /** Corner only: the story's mark sits under the rings by design and keeps its whole glow. */
    readonly ringsClearance: RingsClearance | null;
  };
  readonly card: {
    readonly logo: CardRect;
    readonly url: TextLine;
  };
}

/** The reference frame: the 1080 × 1920 story. */
export const REFERENCE_SIZE: FrameSize = { width: 1080, height: 1920 };
const REFERENCE_SHORT = 1080;
/** The scrim's top and the card block's top, as fractions of the height. */
const MARK_TOP = 1330 / 1920;
const CARD_TOP = 646 / 1920;

/** The safe area's margin at 1080: the corner mark's distance from the right and bottom edges. */
const CORNER_MARGIN = Math.round(SAFE_MARGIN * REFERENCE_SHORT);

/** A rect by its left edge from the frame's centre and its top from the anchor, at 1080. */
interface Offset {
  readonly dx: number;
  readonly dy: number;
  readonly w: number;
  readonly h: number;
}
/**
 * The mark's zone. It is no longer drawn as a box (the frame is
 * already dark, a black box looked pasted on); drawBrandMark lays a soft glow centred on
 * it, and the scene keeps its light out of it.
 */
const MARK_SCRIM: Offset = { dx: -250, dy: 0, w: 500, h: 176 };
/**
 * public/brand/untzel-lockup-dark.png (880 × 136: Techno Inspire | Untzel) at
 * 72 px high; the Techno Inspire part is 51 px, over the 48 px video minimum.
 */
const MARK_LOGO: Offset = { dx: -233, dy: 0, w: 466, h: 72 };
/**
 * The URL's ink starts about 68 px under the logo (keep them apart).
 * "untzel.com" at 32 px is 154.2 px of ink (fontTools, Hanken Grotesk 600): 8 px to spare
 * on each side.
 */
const MARK_URL: Offset = { dx: -85, dy: 132, w: 170, h: 44 };
const MARK_URL_BASELINE = 164;
const MARK_URL_PX = 32;
const MARK_RADIUS = 28;
/** The glow's cut about the rings, at 1080: a 2 px margin, then a 16 px fade. */
const RINGS_MARGIN = 2;
const RINGS_FEATHER = 16;
/** The Untzel lockup at 776 × 120; with the URL, the block sits on the frame's centre line. */
const CARD_LOGO: Offset = { dx: -388, dy: 177, w: 776, h: 120 };
/**
 * About 110 px of air between the logo and the URL's ink. "untzel.com"
 * at 44 px is 212.0 px of ink (fontTools, Hanken Grotesk 600); 8 px to spare.
 */
const CARD_URL: Offset = { dx: -114, dy: 401, w: 228, h: 56 };
const CARD_URL_BASELINE = 440;
const CARD_URL_PX = 44;

/** A landscape frame carries the mark in the corner; the story keeps it under the rings. */
export function markPlacement(size: FrameSize): MarkPlacement {
  return size.width > size.height ? "corner" : "centred";
}

export function brandLayout(size: FrameSize): BrandLayout {
  const scale = Math.min(size.width, size.height) / REFERENCE_SHORT;
  const centerX = size.width / 2;
  const placement = markPlacement(size);
  const anchor = markAnchor(size, scale, placement);
  // Anchors rounded at 1080 and then scaled, so 4K is HD doubled to the pixel.
  const cardTop = Math.round((size.height / scale) * CARD_TOP) * scale;
  const place = (offset: Offset, axis: number, top: number): CardRect => ({
    x: Math.round(axis + offset.dx * scale),
    y: top + offset.dy * scale,
    w: offset.w * scale,
    h: offset.h * scale,
  });
  const line = (offset: Offset, axis: number, top: number, baseline: number, fontPx: number): TextLine => ({
    rect: place(offset, axis, top),
    baseline: top + baseline * scale,
    fontPx: fontPx * scale,
  });
  return {
    size,
    scale,
    centerX,
    mark: {
      placement,
      centerX: anchor.centerX,
      scrim: place(MARK_SCRIM, anchor.centerX, anchor.top),
      scrimRadius: MARK_RADIUS * scale,
      logo: place(MARK_LOGO, anchor.centerX, anchor.top),
      url: line(MARK_URL, anchor.centerX, anchor.top, MARK_URL_BASELINE, MARK_URL_PX),
      ringsClearance: placement === "corner" ? ringsClearance(size, scale) : null,
    },
    card: {
      logo: place(CARD_LOGO, centerX, cardTop),
      url: line(CARD_URL, centerX, cardTop, CARD_URL_BASELINE, CARD_URL_PX),
    },
  };
}

/** The mark's axis and the scrim's top, in frame pixels. */
function markAnchor(size: FrameSize, scale: number, placement: MarkPlacement): { readonly centerX: number; readonly top: number } {
  if (placement === "centred") return { centerX: size.width / 2, top: Math.round((size.height / scale) * MARK_TOP) * scale };
  const width = size.width / scale;
  const height = size.height / scale;
  return {
    centerX: (width - CORNER_MARGIN - MARK_SCRIM.w / 2) * scale,
    top: (height - CORNER_MARGIN - MARK_SCRIM.h) * scale,
  };
}

/** The rings' design disc of this frame (fitScene), widened by the cut's margin and fade. */
function ringsClearance(size: FrameSize, scale: number): RingsClearance {
  const radius = DESIGN_RADIUS * fitScene(size).scale * size.height;
  const inner = radius + RINGS_MARGIN * scale;
  return { centerX: size.width / 2, centerY: size.height / 2, inner, outer: inner + RINGS_FEATHER * scale };
}
/** The bundled face at a size: "600 32px 'Hanken Grotesk'". */
export function brandFont(fontPx: number): string {
  return `600 ${fontPx}px 'Hanken Grotesk'`;
}
