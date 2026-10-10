// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the transport's range ruler draws and what its gestures mean:
// whole bars, the handles' values and words, the keys, the two taps,
// the bar numbers and the bar in edit. Pure, tested without the DOM. Snapping and clamping
// are the session's rules, not copied here.
import { clampPlayRange, snapToBar } from "@untzel/session/rules";
import type { PlaybackMode, PlayRangeView, RulerPartView } from "@untzel/presentation/view-model";
import { rangePhrases, rangeStrings } from "../../copy/copy";
import type { BarNumber, Edges, Handle, RulerScale, RulerView } from "./ruler-geometry";

export interface Span {
  readonly startBar: number;
  readonly endBar: number;
}

/** The bar in edit in the track detail (0-based) and how long its pattern is; null when the detail is closed. */
export interface EditingBarView {
  readonly bar: number;
  readonly patternBars: number;
}

/** Bars 3–6 stand between edges 2 and 6. */
export function edgesOfSpan(span: Span): Edges {
  return { start: span.startBar - 1, end: span.endBar };
}

export function spanOfEdges(edges: Edges): Span {
  return { startBar: Math.round(edges.start) + 1, endBar: Math.round(edges.end) };
}

/** The needle sits in the middle of the bar that plays. */
export function playheadFraction(bar: number | null, lastBar: number): number | null {
  if (bar === null || lastBar < 1) return null;
  return (Math.min(Math.max(bar, 1), lastBar) - 0.5) / lastBar;
}

/** Without a range the handles rest at the ends of the ruler. */
export function shownSpan(range: Span | null, lastBar: number): Span {
  return range ?? { startBar: 1, endBar: Math.max(1, lastBar) };
}

/** A handle moved to `bar`: one handle stops at the other; the result is clamped to the ruler. */
export function moveHandle(range: Span | null, handle: Handle, bar: number, lastBar: number): Span {
  const current = shownSpan(range, lastBar);
  const moved = handle === "start" ? { startBar: Math.min(Math.max(bar, 1), current.endBar), endBar: current.endBar } : { startBar: current.startBar, endBar: Math.max(bar, current.startBar) };
  return clampPlayRange({ ...moved, cycle: true }, lastBar).range;
}

/** The bar a key takes the handle to, or null for a key the slider ignores. */
export function keyTarget(key: string, shift: boolean, bar: number, min: number, max: number): number | null {
  const step = shift ? 4 : 1;
  const targets: Record<string, number> = {
    ArrowLeft: bar - step,
    ArrowDown: bar - step,
    ArrowRight: bar + step,
    ArrowUp: bar + step,
    PageDown: bar - 4,
    PageUp: bar + 4,
    Home: min,
    End: max,
  };
  const target = targets[key];
  return target === undefined ? null : Math.min(Math.max(target, min), max);
}

/** The slider's limits: the start runs from 1 to the end, the end from the start to the last bar. */
export function handleLimits(span: Span, handle: Handle, lastBar: number): { readonly min: number; readonly max: number } {
  return handle === "start" ? { min: 1, max: span.endBar } : { min: span.startBar, max: lastBar };
}

/** aria-valuetext: "Start, bar 3 of 8"; in a song, the part's name; without a range, "whole loop". */
export function handleValueText(view: Pick<PlayRangeView, "mode" | "range" | "lastBar" | "parts">, handle: Handle, bar: number): string {
  const word = handle === "start" ? rangeStrings.start : rangeStrings.end;
  const extra = view.range === null ? (view.mode === "loop" ? rangeStrings.wholeLoopValue : rangeStrings.wholeSongValue) : partNameAt(view.parts, bar);
  return rangePhrases.handleValue(word, bar, view.lastBar, extra);
}

/** The part under a 1-based bar of the song. */
export function partAt(parts: readonly RulerPartView[], bar: number): RulerPartView | null {
  return parts.find((part) => bar >= part.startBar && bar <= part.endBar) ?? null;
}

export function partNameAt(parts: readonly RulerPartView[], bar: number): string | null {
  return partAt(parts, bar)?.name ?? null;
}

/** The first of two taps: the bar waits for the second, which closes the range in either order. */
export type TapResult = { readonly kind: "pending"; readonly bar: number } | { readonly kind: "range"; readonly span: Span };

export function tapBar(pending: number | null, bar: number): TapResult {
  if (pending === null) return { kind: "pending", bar };
  return { kind: "range", span: { startBar: Math.min(pending, bar), endBar: Math.max(pending, bar) } };
}

/** In song mode a tap means the part under it: the first tap marks its start, the second its end. */
export function songTapSpan(parts: readonly RulerPartView[], first: number, second: number): Span | null {
  const a = partAt(parts, first);
  const b = partAt(parts, second);
  if (a === null || b === null) return null;
  return { startBar: Math.min(a.startBar, b.startBar), endBar: Math.max(a.endBar, b.endBar) };
}

/** The first tap's outline: the bar, or in song mode the part under it. */
export function pendingSpan(view: Pick<PlayRangeView, "mode" | "parts">, bar: number): Span {
  return (view.mode === "song" ? partAt(view.parts, bar) : null) ?? { startBar: bar, endBar: bar };
}

/** Play from here on a tapped bar; in song mode, from the start of the part under it. */
export function startOfTap(view: Pick<PlayRangeView, "mode" | "parts">, bar: number): number {
  return pendingSpan(view, bar).startBar;
}

/**
 * The numbers under the ruler. Loop: every bar. Song: 1, each part's first bar, the range's
 * ends and the last bar; a part start right after the range end gives way to it (28, not 29).
 */
export function barNumbers(mode: PlaybackMode, lastBar: number, range: Span | null, parts: readonly RulerPartView[]): readonly BarNumber[] {
  if (lastBar < 1) return [];
  if (mode === "loop") {
    return Array.from({ length: lastBar }, (_, index) => ({ bar: index + 1, isStrong: range !== null && index + 1 >= range.startBar && index + 1 <= range.endBar }));
  }
  const bars = new Set<number>([1, lastBar, ...parts.map((part) => part.startBar)]);
  if (range !== null) {
    bars.add(range.startBar);
    bars.add(range.endBar);
    if (range.endBar + 1 < lastBar) bars.delete(range.endBar + 1);
  }
  return [...bars]
    .filter((bar) => bar >= 1 && bar <= lastBar)
    .sort((a, b) => a - b)
    .map((bar) => ({ bar, isStrong: range !== null && (bar === range.startBar || bar === range.endBar) }));
}

/**
 * The loop bars that play the pattern bar in edit: the
 * pattern starts again every pass, so bar 2 of a 4-bar kick under an 8-bar loop is 2 and 6.
 * The song's parts restart patterns on their own: no outline there.
 */
export function editingBarsOnRuler(mode: PlaybackMode, lastBar: number, editing: EditingBarView | null): readonly number[] {
  // A 1-bar pattern has no bar in edit (its thumbnails do not show either).
  if (mode !== "loop" || editing === null || editing.patternBars <= 1) return [];
  return Array.from({ length: Math.max(0, lastBar) }, (_, index) => index + 1).filter((bar) => (bar - 1) % editing.patternBars === editing.bar);
}

/** What the transport's ruler draws for this play range, first tap and bar in edit. */
export function transportRulerView(view: PlayRangeView, pendingBar: number | null, editing: EditingBarView | null): RulerView {
  const lastBar = Math.max(1, view.lastBar);
  const span = shownSpan(view.range, lastBar);
  const handle = (which: Handle) => {
    const bar = which === "start" ? span.startBar : span.endBar;
    const { min, max } = handleLimits(span, which, lastBar);
    return { min, max, now: bar, valueText: handleValueText(view, which, bar) };
  };
  return {
    mode: view.mode,
    lastBar,
    parts: view.parts,
    hasRange: view.range !== null,
    edges: edgesOfSpan(span),
    pending: pendingBar === null ? null : edgesOfSpan(pendingSpan(view, pendingBar)),
    playhead: playheadFraction(view.playheadBar, lastBar),
    editingBars: editingBarsOnRuler(view.mode, view.lastBar, editing),
    numbers: barNumbers(view.mode, view.lastBar, view.range, view.parts),
    handles: { start: handle("start"), end: handle("end") },
    isInert: view.lastBar <= 1,
  };
}

/** The transport's handles move by whole bars: a drag snaps to the bar under the pointer. */
export function barScale(view: Pick<PlayRangeView, "range" | "lastBar">): RulerScale {
  const lastBar = Math.max(1, view.lastBar);
  return {
    drag: (handle, at) => edgesOfSpan(moveHandle(view.range, handle, snapToBar(at, lastBar), lastBar)),
    key: (handle, key, shift) => {
      const span = shownSpan(view.range, lastBar);
      const bar = handle === "start" ? span.startBar : span.endBar;
      const { min, max } = handleLimits(span, handle, lastBar);
      const target = keyTarget(key, shift, bar, min, max);
      return target === null ? null : edgesOfSpan(moveHandle(view.range, handle, target, lastBar));
    },
    dragLabel: (handle, edges) => {
      const span = spanOfEdges(edges);
      return handle === "start" ? rangePhrases.handleLabel(rangeStrings.start, span.startBar) : rangePhrases.handleLabel(rangeStrings.end, span.endBar);
    },
  };
}

