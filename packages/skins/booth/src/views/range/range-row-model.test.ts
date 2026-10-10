// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { PlayRangeView } from "@untzel/presentation/view-model";
import { pendingHint, rangeRowState } from "./range-row-model";

const PARTS = [
  { name: "intro", startBar: 1, endBar: 8 },
  { name: "build", startBar: 9, endBar: 12 },
  { name: "drop", startBar: 13, endBar: 28 },
  { name: "break", startBar: 29, endBar: 36 },
  { name: "build", startBar: 37, endBar: 40 },
  { name: "drop", startBar: 41, endBar: 56 },
];
const range = (startBar: number, endBar: number, cycle = true) => ({ startBar, endBar, cycle });

describe("range row", () => {
  const base: PlayRangeView = { mode: "loop", lastBar: 8, range: range(3, 6), sounding: null, playheadBar: 4, parts: [], songNames: null };

  it("the chip, the loop's note, and the whole-loop hint without a range", () => {
    expect(rangeRowState(base)).toMatchObject({ chip: "Range: bars 3–6", hasRange: true, note: "Repeats bars 3 to 6. Changes on the next bar.", isCycleShown: false });
    expect(rangeRowState({ ...base, range: range(3, 3) }).note).toBe("Repeats bar 3. Changes on the next bar.");
    expect(rangeRowState({ ...base, range: null })).toMatchObject({ chip: "Whole loop · drag a handle or tap two bars", hasRange: false, note: null });
    expect(rangeRowState({ ...base, range: null, lastBar: 1 })).toMatchObject({ chip: "The loop is 1 bar.", isInert: true });
  });

  it("the song's Cycle sentence, on and off", () => {
    const song: PlayRangeView = { ...base, mode: "song", lastBar: 56, range: range(9, 28), parts: PARTS, songNames: { first: "build", last: "drop", repeated: true, single: false } };
    expect(rangeRowState(song)).toMatchObject({ isCycleShown: true, cycle: true, note: "Repeats build → drop, bars 9–28. With Cycle off it plays on into the rest of the song." });
    expect(rangeRowState({ ...song, range: range(9, 28, false) }).note).toBe("Plays from build, bar 9, then on into the rest of the song.");
  });

  it("the first tap's hint", () => {
    expect(pendingHint(base, 3)).toBe("From bar 3: tap the end bar");
    expect(pendingHint({ mode: "song", parts: PARTS }, 10)).toBe("From build: tap the end part");
  });
});
