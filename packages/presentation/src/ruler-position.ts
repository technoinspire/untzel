// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the ruler is now, from the latest report and the bars since. The
// transport reports the first bar line of each window, up to 120 ms ahead, so "now" may
// still be the bar before it; with a cycling play range the bar before the range's start
// is its end, not the bar to its left. Pure.
import type { PlayRange } from "@untzel/session";

/**
 * The 0-based ruler bar `elapsed` bars after the reported one (−1: the bar before), on a
 * ruler of `lastBar` bars, wrapping inside `range` when it cycles.
 */
export function rulerBarNow(reported: number, elapsed: number, lastBar: number, range: PlayRange | null, cycles: boolean): number {
  const bars = Math.max(1, lastBar);
  const wraps = range !== null && cycles && range.endBar <= bars;
  let bar = reported;
  if (elapsed < 0) {
    if (wraps && bar === range.startBar - 1) return range.endBar - 1;
    return (bar - 1 + bars) % bars;
  }
  for (let step = 0; step < elapsed; step += 1) {
    bar = wraps && bar === range.endBar - 1 ? range.startBar - 1 : (bar + 1) % bars;
  }
  return bar;
}
