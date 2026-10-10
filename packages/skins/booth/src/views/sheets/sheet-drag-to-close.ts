// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { isReducedMotionDocument } from "@untzel/skin-contract";
import { SheetDrag, type SheetDragEnd } from "../../behavior/gestures/sheet-drag";

/** Targets that keep their own gesture: a drag that starts on them never moves the sheet. */
const OWN_GESTURE = "button, a, input, select, textarea, [contenteditable], .cm-editor";

interface DragGesture {
  readonly drag: SheetDrag;
  /** Only while the handle shows: bottom sheets, not the desktop panel. */
  isEnabled(): boolean;
  start(y: number, time: number): void;
  follow(offset: number | null): void;
  finish(end: SheetDragEnd): void;
}

/** A touch that first moves up is a scroll of the body, never a close. */
export function isScrollFirst(isDragging: boolean, y: number, startY: number): boolean {
  return !isDragging && y < startY;
}

/**
 * Drag down to close, wherever the handle shows (bottom sheets, not the desktop panel).
 * Starts on the handle or header (any pointer), or in the body by touch while the body is
 * scrolled to the top; any other drag in the body scrolls it as usual.
 */
export function attachDragToClose(root: HTMLElement, handle: HTMLElement, header: HTMLElement, body: HTMLElement, onClose: () => void): void {
  const drag = new SheetDrag();
  const isEnabled = (): boolean => !root.hidden && handle.checkVisibility();
  const start = (y: number, time: number): void => drag.down(y, time, root.getBoundingClientRect().height);
  const follow = (offset: number | null): void => {
    // Reduced motion (the page's data-motion, read at each move): the sheet stays put
    // while dragging and only closes on release.
    if (offset === null || isReducedMotionDocument(root.ownerDocument)) return;
    root.style.transition = "none";
    root.style.translate = `0 ${offset}px`;
  };
  const finish = (end: SheetDragEnd): void => {
    // Removing both at once lets the sheet's own transition carry it back on snap-back.
    root.style.removeProperty("transition");
    root.style.removeProperty("translate");
    // The release of a drag is not a tap: once the sheet is gone, it would land on what
    // was under it (a track tile).
    if (end !== "none") swallowNextClick();
    if (end === "close") onClose();
  };
  const gesture: DragGesture = { drag, isEnabled, start, follow, finish };
  bindPointerDrag(root, handle, header, gesture);
  bindTouchDrag(body, gesture);
}

/** The handle and the header, by any pointer, outside the controls that keep their own gesture. */
function bindPointerDrag(root: HTMLElement, handle: HTMLElement, header: HTMLElement, { drag, isEnabled, start, follow, finish }: DragGesture): void {
  let pointerId: number | null = null;
  root.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!isEnabled() || event.button !== 0 || !(target instanceof Element)) return;
    if (!(handle.contains(target) || header.contains(target)) || target.closest(OWN_GESTURE) !== null) return;
    pointerId = event.pointerId;
    root.setPointerCapture(event.pointerId);
    start(event.clientY, event.timeStamp);
  });
  root.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) follow(drag.move(event.clientY, event.timeStamp));
  });
  root.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    finish(drag.up(event.clientY, event.timeStamp));
  });
  root.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    finish(drag.cancel());
  });
}

/**
 * Body: touch events, because only a non-passive touchmove can claim the gesture from
 * scrolling, and only when the body cannot scroll further up anyway.
 */
function bindTouchDrag(body: HTMLElement, { drag, isEnabled, start, follow, finish }: DragGesture): void {
  let touchId: number | null = null;
  let touchStartY = 0;
  const touchOf = (event: TouchEvent): Touch | undefined =>
    Array.from(event.changedTouches).find((touch) => touch.identifier === touchId);
  body.addEventListener("touchstart", (event) => {
    const target = event.target;
    const touch = event.changedTouches[0];
    if (!isEnabled() || event.touches.length !== 1 || touch === undefined || body.scrollTop > 0) return;
    if (!(target instanceof Element) || target.closest(".cm-editor, input, select, textarea, [contenteditable]") !== null) return;
    touchId = touch.identifier;
    touchStartY = touch.clientY;
    start(touch.clientY, event.timeStamp);
  }, { passive: true });
  body.addEventListener("touchmove", (event) => {
    const touch = touchOf(event);
    if (touch === undefined) return;
    if (isScrollFirst(drag.isDragging, touch.clientY, touchStartY)) {
      // Moving up first: a scroll, not a close.
      touchId = null;
      drag.cancel();
      return;
    }
    if (event.cancelable) event.preventDefault();
    follow(drag.move(touch.clientY, event.timeStamp));
  }, { passive: false });
  body.addEventListener("touchend", (event) => {
    const touch = touchOf(event);
    if (touch === undefined) return;
    touchId = null;
    finish(drag.up(touch.clientY, event.timeStamp));
  });
  body.addEventListener("touchcancel", (event) => {
    if (touchOf(event) === undefined) return;
    touchId = null;
    finish(drag.cancel());
  });
}

/**
 * The click the browser derives from this release comes in the same task as the
 * pointerup; the listener goes away right after, so it never eats the person's next tap.
 */
function swallowNextClick(): void {
  const swallow = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}
