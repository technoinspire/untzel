// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: flashes in a luminance series, the WCAG 2.2 general-flash reading the
// limiter is held to: a flash is a pair of opposing changes of
// relative luminance of at least 0.10, where the darker state is below 0.80. Pure, so the
// flash-sum browser test and its unit test count the same way.

export const FLASH_STEP = 0.1;
const DARK_ENOUGH = 0.8;

/** Indices where the series completes a change of FLASH_STEP opposite to the last one. */
export function luminanceTransitions(series: readonly number[], step = FLASH_STEP): readonly number[] {
  const events: number[] = [];
  let low = series[0] ?? 0;
  let high = low;
  let direction = 0;
  series.forEach((value, index) => {
    low = Math.min(low, value);
    high = Math.max(high, value);
    if (direction !== 1 && value - low >= step && low < DARK_ENOUGH) {
      events.push(index);
      direction = 1;
      low = high = value;
    } else if (direction !== -1 && high - value >= step && value < DARK_ENOUGH) {
      events.push(index);
      direction = -1;
      low = high = value;
    }
  });
  return events;
}

/** The most flashes (pairs of transitions) inside any one-second window of a series sampled at `fps`. */
export function worstFlashesPerSecond(series: readonly number[], fps: number, step = FLASH_STEP): number {
  const events = luminanceTransitions(series, step);
  let worst = 0;
  for (let first = 0; first < events.length; first += 1) {
    const start = events[first] ?? 0;
    const inside = events.filter((index) => index >= start && index < start + fps).length;
    worst = Math.max(worst, Math.floor(inside / 2));
  }
  return worst;
}
