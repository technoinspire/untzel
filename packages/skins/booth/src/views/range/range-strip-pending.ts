// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PlayRangeView } from "@untzel/presentation/view-model";

/** Another ruler (the mode or the length changed): the waiting first tap may not exist on it. */
export function isOtherRuler(previous: Pick<PlayRangeView, "mode" | "lastBar"> | null, next: Pick<PlayRangeView, "mode" | "lastBar">): boolean {
  return previous !== null && (next.mode !== previous.mode || next.lastBar !== previous.lastBar);
}

export interface PendingTap {
  /** The first of two taps, 1-based; null when none waits. */
  bar(): number | null;
  /** A change says so and redraws the strip. */
  set(bar: number | null): void;
  /** Drops the tap without a redraw: the caller redraws next. */
  drop(): void;
}

/** The first of two taps on the ruler; Esc drops it, and only it, while it waits. */
export function createPendingTap(root: HTMLElement, onPending: (isPending: boolean) => void, redraw: () => void): PendingTap {
  let pending: number | null = null;
  const set = (bar: number | null): void => {
    if (bar === pending) return;
    pending = bar;
    onPending(bar !== null);
    redraw();
  };
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || pending === null) return;
    event.stopPropagation();
    set(null);
  });
  return {
    bar: () => pending,
    set,
    drop() {
      if (pending === null) return;
      pending = null;
      onPending(false);
    },
  };
}
