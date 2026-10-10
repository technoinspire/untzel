// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { rovingIndex } from "../primitives/roving-keys";

/**
 * Arrow keys, Home and End move between the thumbnails with one tab stop and edit the bar
 * they reach, kept in view.
 */
export function bindBarThumbKeys(root: HTMLElement, thumbs: readonly HTMLButtonElement[], onEdit: (bar: number) => void): void {
  root.addEventListener("keydown", (event) => {
    const index = rovingIndex(thumbs.indexOf(event.target as HTMLButtonElement), thumbs.length, event.key, false);
    if (index === null) return;
    event.preventDefault();
    const next = thumbs[index];
    if (next === undefined) return;
    for (const thumb of thumbs) thumb.tabIndex = thumb === next ? 0 : -1;
    next.focus();
    reveal(root, next);
    // Selection follows focus: choosing the bar to edit changes no text, and a focus
    // ring apart from the flare ring looked like the white "playing" marker.
    onEdit(thumbs.indexOf(next));
  });
}

/** Scrolls the row just enough to show `node`; no animation. */
export function reveal(scroller: HTMLElement, node: HTMLElement): void {
  // The row is position: relative, so it is the thumbnail's offsetParent.
  const left = node.offsetLeft;
  const right = left + node.offsetWidth;
  if (left < scroller.scrollLeft) scroller.scrollLeft = left;
  else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
}
