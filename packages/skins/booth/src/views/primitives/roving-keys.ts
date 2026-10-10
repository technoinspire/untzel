// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The roving-focus maps of the views. The bar thumbnails (a row) and the song's parts (a
// column) share one: the arrows of the axis move one item, Home and End go to the ends.
// The piano keys and the five lengths share another, Left and Right only. Both stop at
// the ends.

/** ArrowLeft and ArrowRight move one item, stopping at both ends; null: not a move. */
export function nextKeyIndex(index: number, key: string, count: number): number | null {
  if (index < 0 || (key !== "ArrowRight" && key !== "ArrowLeft")) return null;
  return Math.max(0, Math.min(count - 1, index + (key === "ArrowRight" ? 1 : -1)));
}

/** The item the focus moves to from `index` of `count`; null: the key is not a move, or the target is no item. */
export function rovingIndex(index: number, count: number, key: string, isVertical: boolean): number | null {
  if (index < 0) return null;
  const last = count - 1;
  const target =
    key === (isVertical ? "ArrowDown" : "ArrowRight") ? index + 1
    : key === (isVertical ? "ArrowUp" : "ArrowLeft") ? index - 1
    : key === "Home" ? 0
    : key === "End" ? last
    : null;
  return target === null ? null : Math.min(last, Math.max(0, target));
}
