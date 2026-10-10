// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Swipe between bars in the track detail. The
// rule is pure so it is tested in Node; bindSwipe attaches it to a node.

/** Far enough to be a swipe, not a tap that moved. */
export const SWIPE_MIN_PX = 48;
/** Mostly sideways: a vertical drag scrolls the sheet instead. */
const SIDEWAYS_RATIO = 1.5;
/** A slow drag is not a swipe. */
const SWIPE_MAX_MS = 800;

/** +1 next bar (finger to the left), -1 previous bar, null for anything else. */
export function swipeDirection(dx: number, dy: number, ms: number): -1 | 1 | null {
  if (ms > SWIPE_MAX_MS || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SIDEWAYS_RATIO) return null;
  return dx < 0 ? 1 : -1;
}

/** Calls `onSwipe` on a sideways swipe; the click that follows it is not a tap on a step. */
export function bindSwipe(node: HTMLElement, onSwipe: (direction: -1 | 1) => void): void {
  let start: { readonly x: number; readonly y: number; readonly at: number; readonly id: number } | null = null;
  node.addEventListener("pointerdown", (event) => {
    if (event.button === 0) start = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId };
  });
  node.addEventListener("pointercancel", () => (start = null));
  node.addEventListener("pointerup", (event) => {
    if (start === null || start.id !== event.pointerId) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y, event.timeStamp - start.at);
    start = null;
    if (direction === null) return;
    swallowNextClick();
    onSwipe(direction);
  });
}

function swallowNextClick(): void {
  const swallow = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}
