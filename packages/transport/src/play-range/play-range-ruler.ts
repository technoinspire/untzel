// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range's ruler in each mode: how long it is, which of its bars just
// played, and where a play starts with a range. Pure; the Transport only asks.
import { loopLengthOf, type Arrangement, type Program } from "@untzel/core";
import { clampPlayRange, type PlayRange } from "./play-range";
import { rulerBarBefore } from "./play-range-step";
import type { PlaybackMode } from "../types";

/** The last bar of the ruler: the loop length in loop mode, the song's bars in song mode (null without one). */
export function lastBarOf(program: Pick<Program, "loopBars" | "tracks">, arrangement: Arrangement | null, mode: PlaybackMode): number | null {
  if (mode === "loop") return loopLengthOf(program).bars;
  return arrangement?.totalBars ?? null;
}

/** Where the pass of each mode sits: loopStart (loop) or songStartBar (song). */
export interface PassOffsets {
  readonly mode: PlaybackMode;
  readonly loopStart: number | null;
  readonly songStartBar: number;
}

/** The ruler bar (1-based) that played before absolute bar `bar`, under the program that played it. */
export function rulerBarPlayed(bar: number, offsets: PassOffsets, program: Pick<Program, "loopBars" | "tracks">, arrangement: Arrangement | null): number | null {
  if (offsets.mode === "loop") return rulerBarBefore(bar, offsets.loopStart ?? 0, loopLengthOf(program).bars, true);
  if (arrangement === null) return null;
  return rulerBarBefore(bar, offsets.songStartBar, arrangement.totalBars, arrangement.loops);
}

/** Stopped with a range: the 0-based bar play starts on, the range's first, clamped to the ruler. */
export function rangeStartBar(range: PlayRange | null, program: Pick<Program, "loopBars" | "tracks">, arrangement: Arrangement | null, mode: PlaybackMode): number | null {
  const lastBar = lastBarOf(program, arrangement, mode);
  if (range === null || lastBar === null) return null;
  return clampPlayRange(range, lastBar).range.startBar - 1;
}
