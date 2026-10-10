// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The menu's roving focus (WAI-ARIA menu pattern): the arrows walk the
// flattened list in reading order and wrap, Home and End go to the ends, and a letter
// jumps to the next item that starts with it. Pure; the view moves the focus.
export type MenuKeyResult =
  | { readonly kind: "focus"; readonly index: number }
  /** Esc: close and give the focus back to the Menu button. */
  | { readonly kind: "close" }
  /** Tab: close and let the page's order go on. */
  | { readonly kind: "leave" }
  | { readonly kind: "none" };
/** `labels`: each item's visible label, in reading order; `current`: the focused index. */
export function menuKey(key: string, current: number, labels: readonly string[]): MenuKeyResult {
  const count = labels.length;
  if (count === 0) return { kind: "none" };
  switch (key) {
    case "ArrowDown":
      return { kind: "focus", index: (current + 1) % count };
    case "ArrowUp":
      return { kind: "focus", index: (current - 1 + count) % count };
    case "Home":
      return { kind: "focus", index: 0 };
    case "End":
      return { kind: "focus", index: count - 1 };
    case "Escape":
      return { kind: "close" };
    case "Tab":
      return { kind: "leave" };
    default:
      return typeAhead(key, current, labels);
  }
}
function typeAhead(key: string, current: number, labels: readonly string[]): MenuKeyResult {
  if ([...key].length !== 1 || key.trim() === "") return { kind: "none" };
  const letter = key.toLocaleLowerCase();
  for (let step = 1; step <= labels.length; step += 1) {
    const index = (current + step) % labels.length;
    if ((labels[index] ?? "").toLocaleLowerCase().startsWith(letter)) return { kind: "focus", index };
  }
  return { kind: "none" };
}
