// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What a range ruler draws and how its handles move, for both rulers that use it:
// the transport's play range, by whole bars, and the export's stretch, by steps.
// Positions are edges in bars from the ruler's left edge (0 … lastBar), so one view draws
// both; each caller brings its own RulerScale for the gestures. Pure, tested without the DOM.
import type { PlaybackMode, RulerPartView } from "@untzel/presentation/view-model";

export type Handle = "start" | "end";

/** Where the two handles stand, in bars from the left edge; fractions on the export's ruler. */
export interface Edges {
  readonly start: number;
  readonly end: number;
}

export interface RulerHandleView {
  readonly min: number;
  readonly max: number;
  readonly now: number;
  readonly valueText: string;
}

export interface BarNumber {
  readonly bar: number;
  /** Bold: inside the range in loop mode, only its ends in song mode. */
  readonly isStrong: boolean;
}

/** Everything the ruler view draws; each ruler builds it from its own view model. */
export interface RulerView {
  readonly mode: PlaybackMode;
  readonly lastBar: number;
  readonly parts: readonly RulerPartView[];
  /** A range is set: the band shows and the handles are filled. */
  readonly hasRange: boolean;
  readonly edges: Edges;
  /** The first of two taps, outlined dashed; null when none waits. */
  readonly pending: Edges | null;
  /** 0..1 of the ruler's width; null when the ruler's mode does not sound. */
  readonly playhead: number | null;
  /** 1-based bars outlined in flare: the bar of the pattern in edit, wherever the loop plays it. */
  readonly editingBars: readonly number[];
  readonly numbers: readonly BarNumber[];
  readonly handles: Readonly<Record<Handle, RulerHandleView>>;
  /** A ruler of one bar has nothing to range. */
  readonly isInert: boolean;
}

/** How a ruler's handles move: by whole bars on the transport, by steps on the export. */
export interface RulerScale {
  /** A handle dragged to `at` bars from the left edge; `isFine` while Shift or Alt is held. */
  drag(handle: Handle, at: number, isFine: boolean): Edges;
  /** A key on a handle; null for a key the slider ignores. */
  key(handle: Handle, key: string, shift: boolean): Edges | null;
  /** Over the handle while it is dragged: "Start · bar 3". */
  dragLabel(handle: Handle, edges: Edges): string;
}

/** A pointer moved less than this many pixels is a tap on the bar under it, not a drag. */
export const TAP_SLOP_PX = 6;
/** Two handle lines closer than this: the direction of the first move picks the handle. */
export const NEAR_HANDLES_PX = 12;

/** Left edge and width of the stretch between two edges, as fractions of the ruler. */
export function edgeGeometry(edges: Edges, lastBar: number): { readonly left: number; readonly width: number } {
  const bars = Math.max(1, lastBar);
  return { left: edges.start / bars, width: (edges.end - edges.start) / bars };
}

export function sameEdges(a: Edges, b: Edges): boolean {
  return a.start === b.start && a.end === b.end;
}

/**
 * Which handle a press on a handle target drags:
 * the one on the pointer's side of the middle between the two lines; with the lines under
 * 12 px apart, the direction of the first 6 px (left, Start; right, End), so a short range
 * can always grow both ways.
 */
export function handleForPointer(pointerX: number, startX: number, endX: number, movedX: number): Handle {
  if (Math.abs(endX - startX) < NEAR_HANDLES_PX) return movedX < 0 ? "start" : "end";
  return pointerX < (startX + endX) / 2 ? "start" : "end";
}
