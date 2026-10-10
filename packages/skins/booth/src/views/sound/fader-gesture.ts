// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ParameterView } from "@untzel/presentation/view-model";
import { DOUBLE_TAP_MS, dragPosition, keySteps } from "./gain-fader-model";

export interface GainFaderCallbacks {
  /** A drag or a tap: the position 0..1; the session writes the gain by the fader law. */
  readonly onPosition: (position: number) => void;
  readonly onSteps: (steps: number) => void;
  readonly onReset: () => void;
  /** A gesture ended: one undo step. */
  readonly onEnd: () => void;
  /** A gesture replaced a signal on gain with a fixed value. */
  readonly onSignalReplaced: () => void;
}

/** Where a pointer at `clientX` falls along a track starting at `left`, 0..1; a track not laid out is 0. */
export function faderPositionAt(clientX: number, left: number, width: number): number {
  return width <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - left) / width));
}

/**
 * The fader's gestures: a tap or a drag (fine with Shift or Alt), a double tap or double
 * click to 0 dB, and the arrow keys. Returns whether a drag is under way, when the view
 * must not move the thumb under the finger.
 */
// Over 40 lines: the drag and the last tap are gesture state the pointer, key and double-click handlers share.
export function bindFaderGesture(slider: HTMLElement, callbacks: GainFaderCallbacks, shown: () => ParameterView | null, show: (position: number) => void): () => boolean {
  let drag: { readonly pointer: number; readonly startX: number; readonly startPosition: number; moved: boolean } | null = null;
  let lastTap = Number.NEGATIVE_INFINITY;
  const replacing = (): void => {
    const current = shown();
    if (current?.signal !== null && current?.signal !== undefined) callbacks.onSignalReplaced();
  };
  const reset = (): void => {
    replacing();
    callbacks.onReset();
    callbacks.onEnd();
  };
  slider.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.timeStamp - lastTap < DOUBLE_TAP_MS && event.pointerType !== "mouse") {
      lastTap = Number.NEGATIVE_INFINITY;
      reset();
      return;
    }
    lastTap = event.timeStamp;
    slider.setPointerCapture(event.pointerId);
    slider.focus({ preventScroll: true });
    const isFine = event.shiftKey || event.altKey;
    const box = isFine ? null : slider.getBoundingClientRect();
    const start = box === null ? (shown()?.fraction ?? 0) : faderPositionAt(event.clientX, box.left, box.width);
    drag = { pointer: event.pointerId, startX: event.clientX, startPosition: start, moved: false };
    if (!isFine) {
      replacing();
      show(start);
      callbacks.onPosition(start);
    }
  });
  slider.addEventListener("pointermove", (event) => {
    if (drag === null || event.pointerId !== drag.pointer) return;
    const width = slider.getBoundingClientRect().width;
    if (width <= 0) return;
    const next = dragPosition(drag.startPosition, (event.clientX - drag.startX) / width, event.shiftKey || event.altKey);
    drag.moved = true;
    show(next);
    callbacks.onPosition(next);
  });
  // A tap stays open, so a double tap (tap, then 0 dB) is one undo step; a drag closes it.
  const release = (event: PointerEvent): void => {
    if (drag === null || event.pointerId !== drag.pointer) return;
    const moved = drag.moved;
    drag = null;
    if (moved) callbacks.onEnd();
  };
  slider.addEventListener("pointerup", release);
  slider.addEventListener("pointercancel", release);
  slider.addEventListener("dblclick", reset);
  slider.addEventListener("keydown", (event) => {
    const steps = keySteps(event.key);
    if (steps === null) return;
    event.preventDefault();
    replacing();
    callbacks.onSteps(steps);
  });
  slider.addEventListener("keyup", (event) => {
    if (keySteps(event.key) !== null) callbacks.onEnd();
  });
  return () => drag !== null;
}
