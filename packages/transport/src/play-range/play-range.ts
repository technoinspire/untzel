// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range: which bars of the loop or the song play.
// It is playback state, never text. Pure rules, tested without a clock: create, clamp,
// snap, and "Play from here".
// Types only besides the rules, so the controls can snap and clamp through the session's
// rules subpath without pulling the transport into the initial JS.
import type { PlaybackMode } from "../types";

/** Bars counted from 1, both included: 1 ≤ startBar ≤ endBar ≤ last bar of the ruler. */
export interface PlayRange {
  readonly startBar: number;
  readonly endBar: number;
  /** Song mode: true repeats the range, false plays on into the song. Always true in loop mode. */
  readonly cycle: boolean;
}

/** What the transport receives: the range of one mode, and whether the gesture moves the music there. */
export interface PlayRangeChange {
  readonly mode: PlaybackMode;
  readonly range: PlayRange | null;
  /** Play from here and a part's Play: the music goes to the range start on the next bar. */
  readonly locate: boolean;
}

export type CreatedPlayRange = PlayRange | { readonly code: "INVALID_RANGE" };

export function createPlayRange(startBar: number, endBar: number, cycle: boolean): CreatedPlayRange {
  if (!Number.isInteger(startBar) || !Number.isInteger(endBar)) return { code: "INVALID_RANGE" };
  if (startBar < 1 || endBar < startBar) return { code: "INVALID_RANGE" };
  return { startBar, endBar, cycle };
}

export function isPlayRange(value: CreatedPlayRange): value is PlayRange {
  return !("code" in value);
}

/** The range cut to the ruler: an end past the last bar comes back to it, never dropped. */
export function clampPlayRange(range: PlayRange, lastBar: number): { readonly range: PlayRange; readonly changed: boolean } {
  const last = Math.max(1, Math.floor(lastBar));
  const endBar = Math.min(range.endBar, last);
  const startBar = Math.min(range.startBar, endBar);
  const changed = endBar !== range.endBar || startBar !== range.startBar;
  return { range: changed ? { ...range, startBar, endBar } : range, changed };
}

export function isInPlayRange(bar: number, range: PlayRange): boolean {
  return bar >= range.startBar && bar <= range.endBar;
}

/** A point on the ruler, in bars from its left edge (0 … lastBar), to the bar under it. */
export function snapToBar(position: number, lastBar: number): number {
  if (!Number.isFinite(position)) return 1;
  return Math.min(Math.max(Math.floor(position) + 1, 1), Math.max(1, lastBar));
}

/**
 * Play from here moves only the start (design, "Play from here"): without a range it
 * plays to the end (on into the song in song mode); with one, it keeps the end and the
 * cycle, unless the bar is past the end, which then becomes the last bar.
 */
export function playFromBar(range: PlayRange | null, bar: number, lastBar: number, mode: PlaybackMode): PlayRange {
  const startBar = Math.min(Math.max(1, Math.floor(bar)), lastBar);
  if (range === null) return { startBar, endBar: lastBar, cycle: mode === "loop" };
  const endBar = startBar <= range.endBar ? Math.min(range.endBar, lastBar) : lastBar;
  return { startBar, endBar, cycle: mode === "loop" ? true : range.cycle };
}
