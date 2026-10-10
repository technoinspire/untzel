// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Which bar of the ruler plays next with a play range. Pure: the
// transport asks these at each bar boundary and only moves its offsets. Bars are counted
// from 1, the way the ruler shows them.
import { isInPlayRange, type PlayRange } from "./play-range";
import type { PlaybackMode } from "../types";

export type NextBar =
  | { readonly kind: "bar"; readonly bar: number; readonly jumped: boolean }
  | { readonly kind: "end" };

/**
 * The bar that would follow `current` with no range at all. `>=` on purpose: the loop may
 * have shrunk behind the bar playing (8 → 4 while bar 6 plays gives 1, never 7).
 */
export function barWithoutRange(current: number, lastBar: number, mode: PlaybackMode, songLoops: boolean): NextBar {
  if (current < lastBar) return { kind: "bar", bar: Math.max(1, current + 1), jumped: false };
  if (mode === "loop" || songLoops) return { kind: "bar", bar: 1, jumped: false };
  return { kind: "end" };
}

/**
 * The ordinary advance. With Cycle (always in loop mode) the range repeats, and a bar
 * outside it, after a clamp, goes to its start. Without Cycle the range is only where the
 * song started: it plays on, as without a range.
 */
export function nextRangeBar(current: number, range: PlayRange | null, lastBar: number, mode: PlaybackMode, songLoops: boolean): NextBar {
  const cycles = range !== null && (mode === "loop" || range.cycle);
  if (!cycles) return barWithoutRange(current, lastBar, mode, songLoops);
  if (current >= range.startBar && current < range.endBar) return { kind: "bar", bar: current + 1, jumped: false };
  return { kind: "bar", bar: range.startBar, jumped: current !== range.endBar };
}

export interface RangeChange {
  /** The bar that just played. */
  readonly current: number;
  readonly lastBar: number;
  readonly mode: PlaybackMode;
  readonly songLoops: boolean;
  /** The range before the change, null without one. */
  readonly previous: PlayRange | null;
  /** The range from this boundary on, already clamped; null when it was cleared. */
  readonly next: PlayRange | null;
  /** Play from here, a part's Play: always to the start. */
  readonly locate: boolean;
}

/**
 * The first bar after a range change, by five rules: cleared → the bar
 * that comes anyway; locate → the start; that bar inside the new range → it, no jump;
 * Cycle off with the same start (only the end moved) → it, no jump; else → the start.
 */
export function barAfterRangeChange(change: RangeChange): NextBar {
  const candidate = barWithoutRange(change.current, change.lastBar, change.mode, change.songLoops);
  const next = change.next;
  if (next === null) return candidate;
  const start: NextBar = { kind: "bar", bar: next.startBar, jumped: true };
  if (change.locate) return start;
  if (candidate.kind === "bar" && isInPlayRange(candidate.bar, next)) return candidate;
  const cycles = change.mode === "loop" || next.cycle;
  if (!cycles && change.previous !== null && change.previous.startBar === next.startBar) return candidate;
  return start;
}

/** The new offset that puts ruler bar `rulerBar` on absolute bar `absoluteBar`: loopStart or songStartBar. */
export function offsetForBar(absoluteBar: number, rulerBar: number): number {
  return absoluteBar - (rulerBar - 1);
}
