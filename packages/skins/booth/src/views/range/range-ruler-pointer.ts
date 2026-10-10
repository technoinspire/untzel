// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { RangeRulerEvents } from "./range-ruler-keys";
import { TAP_SLOP_PX, handleForPointer, sameEdges, type Edges, type Handle, type RulerScale, type RulerView } from "./ruler-geometry";

interface Press {
  readonly pointerId: number;
  readonly x: number;
  readonly isOnHandle: boolean;
  handle: Handle | null;
  moved: boolean;
  edges: Edges | null;
}

/** The bar a tap lands on, 1-based, at `bars` along the ruler; never past the last bar. */
export function tappedBar(bars: number, lastBar: number): number {
  return Math.min(Math.floor(bars) + 1, Math.max(1, lastBar));
}

/**
 * A drag on the track moves the handle it started on and sends its edges as it moves and on
 * release; a press under TAP_SLOP_PX is a tap on the bar under it. Returns whether a press
 * is under way, when the view must not move the band under the finger.
 */
// Over 40 lines: the press in flight is gesture state its down, move, up and cancel handlers share.
export function bindRulerPointer(
  track: HTMLElement,
  events: RangeRulerEvents,
  shown: () => RulerView | null,
  scaleOf: () => RulerScale | null,
  drawEdges: (edges: Edges) => void,
  showValue: (handle: Handle | null, edges: Edges | null) => void,
): () => boolean {
  let press: Press | null = null;
  const fractionAt = (clientX: number): number => {
    const box = track.getBoundingClientRect();
    return box.width > 0 ? Math.min(Math.max((clientX - box.left) / box.width, 0), 1) : 0;
  };
  const barsAt = (clientX: number): number => fractionAt(clientX) * Math.max(1, shown()?.lastBar ?? 1);
  const xOf = (bars: number): number => {
    const box = track.getBoundingClientRect();
    return box.left + (bars / Math.max(1, shown()?.lastBar ?? 1)) * box.width;
  };
  track.addEventListener("pointerdown", (event) => {
    const view = shown();
    if (view === null || view.isInert || event.button !== 0) return;
    const isOnHandle = (event.target as HTMLElement).closest("[data-handle]") !== null;
    press = { pointerId: event.pointerId, x: event.clientX, isOnHandle, handle: null, moved: false, edges: null };
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener("pointermove", (event) => {
    const view = shown();
    const scale = scaleOf();
    if (press === null || event.pointerId !== press.pointerId || view === null || scale === null) return;
    if (!press.moved && Math.abs(event.clientX - press.x) < TAP_SLOP_PX) return;
    if (!press.moved && press.isOnHandle) press.handle = handleForPointer(press.x, xOf(view.edges.start), xOf(view.edges.end), event.clientX - press.x);
    press.moved = true;
    if (press.handle === null) return;
    const edges = scale.drag(press.handle, barsAt(event.clientX), event.shiftKey || event.altKey);
    drawEdges(edges);
    showValue(press.handle, edges);
    if (press.edges === null || !sameEdges(press.edges, edges)) events.onEdges(edges, "drag");
    press.edges = edges;
  });
  const release = (event: PointerEvent, isCancelled: boolean): void => {
    const current = press;
    const view = shown();
    const scale = scaleOf();
    if (current === null || event.pointerId !== current.pointerId || view === null || scale === null) return;
    press = null;
    showValue(null, null);
    if (isCancelled) {
      drawEdges(view.edges);
      return;
    }
    if (!current.moved) events.onTap(tappedBar(barsAt(event.clientX), view.lastBar));
    else if (current.handle !== null) events.onEdges(scale.drag(current.handle, barsAt(event.clientX), event.shiftKey || event.altKey), "release");
  };
  track.addEventListener("pointerup", (event) => release(event, false));
  track.addEventListener("pointercancel", (event) => release(event, true));

  return () => press !== null;
}
