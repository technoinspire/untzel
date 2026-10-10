// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A panel that opens inside a scrolling sheet must be seen whole: at 390 the note
// picker's "Choose c2" opened under the Duplicate/Delete footer.

export interface Span {
  readonly top: number;
  readonly bottom: number;
}

/**
 * How far the box must scroll so the item shows whole: positive scrolls down. The least
 * movement; an item taller than the box shows from its top.
 */
export function revealDelta(item: Span, box: Span): number {
  if (item.top < box.top) return item.top - box.top;
  if (item.bottom > box.bottom) return Math.min(item.bottom - box.bottom, item.top - box.top);
  return 0;
}

/** Scrolls the nearest scrolling ancestor of `node` so it shows whole. */
export function revealInScroller(node: HTMLElement, scrollerSelector: string): void {
  const scroller = node.parentElement?.closest<HTMLElement>(scrollerSelector) ?? null;
  if (scroller === null) return;
  const delta = revealDelta(node.getBoundingClientRect(), scroller.getBoundingClientRect());
  if (delta !== 0) scroller.scrollTop += delta;
}
