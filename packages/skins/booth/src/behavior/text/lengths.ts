// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Musical lengths of the length picker: the loop,
// a pattern and a part are chosen among 1, 2, 4, 8 and 16 bars. Any other length is
// written in the Code panel and still shows as written.

import { phrases } from "../../copy/copy";

export const MUSICAL_LENGTHS = [1, 2, 4, 8, 16] as const;

/**
 * The musical length next to `current`: the first one above it (+1) or below it (-1).
 * An odd length written in the text (6) steps to its neighbours (4, 8). Null past the ends.
 */
export function stepLength(current: number, delta: -1 | 1): number | null {
  const found =
    delta > 0
      ? MUSICAL_LENGTHS.find((length) => length > current)
      : [...MUSICAL_LENGTHS].reverse().find((length) => length < current);
  return found ?? null;
}

/** "Editing bar 2 of 4". */
export function editingLabel(bar: number, bars: number): string {
  return phrases.editingBar(bar + 1, bars);
}

/**
 * The rows of the step grid, 8 steps each: "steps 1–8 · 9–16 of bar 2". The grid shows
 * only the bar being edited, so the caption says which steps of which bar.
 */
export function stepRowsCaption(steps: number, bar: number, perRow = 8): string {
  const rows: string[] = [];
  for (let start = 0; start < steps; start += perRow) {
    rows.push(phrases.stepRange(start + 1, Math.min(steps, start + perRow)));
  }
  return phrases.stepRows(rows, bar + 1);
}
