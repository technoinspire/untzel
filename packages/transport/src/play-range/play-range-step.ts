// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range step of a bar boundary: after the mode
// and the loop pass, before the song end. Pure: it gets what the transport knows at the
// boundary and answers where the ruler goes, as the new offset of the pass (loopStart in
// loop mode, songStartBar in song mode). The class only applies the answer.
import { clampPlayRange, type PlayRange } from "./play-range";
import { barAfterRangeChange, nextRangeBar, offsetForBar, type NextBar } from "./play-range-schedule";
import type { PlaybackMode } from "../types";

export interface RangeStepInput {
  readonly mode: PlaybackMode;
  /** The absolute bar being entered (bars since play). */
  readonly bar: number;
  /** The ruler bar that just played, 1-based; null when unknown (song entered here). */
  readonly current: number | null;
  /** The last ruler bar of the program entering here; null in song mode without a song. */
  readonly lastBar: number | null;
  readonly songLoops: boolean;
  /** The mode's stored range, not yet clamped. */
  readonly range: PlayRange | null;
  /** Set when the range changed since the last boundary. */
  readonly change: { readonly previous: PlayRange | null; readonly locate: boolean } | null;
  readonly modeChanged: boolean;
  /** Loop mode: a range already owns the pass (until stop or a mode change). */
  readonly ownsPass: boolean;
}

export type RangeStep =
  | { readonly kind: "keep" }
  /** `offset` is the new loopStart (loop) or songStartBar (song). */
  | { readonly kind: "move"; readonly offset: number; readonly ownsPass: boolean };

const KEEP: RangeStep = { kind: "keep" };

export function playRangeStep(input: RangeStepInput): RangeStep {
  const { lastBar, mode } = input;
  if (lastBar === null) return KEEP;
  const range = input.range === null ? null : clampPlayRange(input.range, lastBar).range;
  if (input.modeChanged) return range === null ? KEEP : moveTo(input, range.startBar);
  const owns = mode === "loop" && input.ownsPass;
  if (range === null && input.change === null && !owns) return KEEP;
  if (input.current === null) return range === null ? KEEP : moveTo(input, range.startBar);
  const next: NextBar =
    input.change === null
      ? nextRangeBar(input.current, range, lastBar, mode, input.songLoops)
      : barAfterRangeChange({ current: input.current, lastBar, mode, songLoops: input.songLoops, previous: input.change.previous, next: range, locate: input.change.locate });
  // The song ends here: the arrangement bar becomes its length, which locate() reads as the end.
  if (next.kind === "end") return { kind: "move", offset: input.bar - lastBar, ownsPass: false };
  return moveTo(input, next.bar);
}

function moveTo(input: RangeStepInput, rulerBar: number): RangeStep {
  return { kind: "move", offset: offsetForBar(input.bar, rulerBar), ownsPass: input.mode === "loop" };
}

/** The ruler bar (1-based) of the bar before `bar`, given the pass offset. */
export function rulerBarBefore(bar: number, offset: number, lastBar: number, loops: boolean): number | null {
  const index = bar - 1 - offset;
  if (index < 0) return null;
  if (!loops) return index + 1;
  return (index % lastBar) + 1;
}
