// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The keys of a 0..1000 slider. The browser's own step is 1/1000,
// which neither the label nor the sound shows: an arrow moves 1%, Shift with an arrow
// 0.1%, PageUp and PageDown 10%, Home and End go to the ends. A drag keeps 1/1000.

const ARROW = 10;
const FINE = 1;
const PAGE = 100;

/** How far one key moves the value; ±Infinity for Home and End; null for any other key. */
export function rangeKeyDelta(key: string, isShift: boolean): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return isShift ? FINE : ARROW;
    case "ArrowLeft":
    case "ArrowDown":
      return isShift ? -FINE : -ARROW;
    case "PageUp":
      return PAGE;
    case "PageDown":
      return -PAGE;
    case "Home":
      return -Infinity;
    case "End":
      return Infinity;
    default:
      return null;
  }
}

/**
 * Takes over the slider's keys. Each key that moves it fires input and then change, as a
 * drag does, so it is one undo step of its own. An inert slider (aria-disabled) stays put.
 */
export function bindRangeKeys(input: HTMLInputElement): void {
  input.addEventListener("keydown", (event) => {
    const delta = rangeKeyDelta(event.key, event.shiftKey);
    if (delta === null || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (input.getAttribute("aria-disabled") === "true") return;
    const value = Number(input.value);
    const next = Math.min(Number(input.max), Math.max(Number(input.min), value + delta));
    if (next === value) return;
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
