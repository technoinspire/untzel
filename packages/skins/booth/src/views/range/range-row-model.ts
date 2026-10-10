// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words of the range row: the chip or the
// whole-loop hint, the loop's note, the Cycle switch and its sentence, and the first
// tap's hint. Pure, tested without the DOM.
import type { PlayRangeView } from "@untzel/presentation/view-model";
import { rangePhrases, rangeStrings } from "../../copy/copy";
import { partNameAt } from "./range-ruler-model";
import { rangeFrom, rangeStretch } from "./range-label";

export interface RangeRowState {
  /** "Range: bars 3–6", or the whole-loop hint when there is no range. */
  readonly chip: string;
  readonly hasRange: boolean;
  /** Loop: "Repeats bars 3 to 6. Changes on the next bar."; Song: the Cycle sentence. */
  readonly note: string | null;
  /** Song mode with a range: the switch is shown. */
  readonly isCycleShown: boolean;
  readonly cycle: boolean;
  /** A ruler of one bar has nothing to range. */
  readonly isInert: boolean;
}

export function rangeRowState(view: PlayRangeView): RangeRowState {
  const range = view.range;
  const isInert = view.lastBar <= 1;
  const whole = view.mode === "loop" ? rangeStrings.wholeLoop : rangeStrings.wholeSong;
  if (range === null) {
    return { chip: isInert && view.mode === "loop" ? rangeStrings.oneBarLoop : whole, hasRange: false, note: null, isCycleShown: false, cycle: true, isInert };
  }
  const chip = rangePhrases.chip(range.startBar, range.endBar);
  if (view.mode === "loop") {
    return { chip, hasRange: true, note: rangePhrases.loopNote(range.startBar, range.endBar), isCycleShown: false, cycle: true, isInert };
  }
  const note = range.cycle ? rangePhrases.cycleOn(rangeStretch(view) ?? "") : rangePhrases.cycleOff(rangeFrom(view) ?? "");
  return { chip, hasRange: true, note, isCycleShown: true, cycle: range.cycle, isInert };
}

/** "From bar 3: tap the end bar", or in a song "From build: tap the end part". */
export function pendingHint(view: Pick<PlayRangeView, "mode" | "parts">, bar: number): string {
  if (view.mode === "song") {
    const part = partNameAt(view.parts, bar);
    if (part !== null) return rangePhrases.pendingPart(part);
  }
  return rangePhrases.pendingBar(bar);
}
