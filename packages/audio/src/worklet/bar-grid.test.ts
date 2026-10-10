// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { MAX_TEMPO_MARKS, nextBarFrame, withTempoMark } from "./bar-grid";

const RATE = 48_000;
/** One bar at 120 BPM: 2 s. */
const BAR = 96_000;

describe("nextBarFrame", () => {
  it("is now when nothing plays", () => {
    expect(nextBarFrame([], 12_345, RATE)).toBe(12_345);
  });

  it("waits for the first beat of a play announced ahead", () => {
    expect(nextBarFrame([{ frame: 5_760, bpm: 120 }], 128, RATE)).toBe(5_760);
  });

  it("rounds up to the next bar line of the tempo in force", () => {
    const marks = [{ frame: 5_760, bpm: 120 }];
    expect(nextBarFrame(marks, 5_760 + 1, RATE)).toBe(5_760 + BAR);
    expect(nextBarFrame(marks, 5_760 + 3 * BAR, RATE)).toBe(5_760 + 3 * BAR);
  });

  it("never passes a tempo change already announced", () => {
    const marks = withTempoMark([{ frame: 0, bpm: 120 }], { frame: BAR + 1_000, bpm: 90 });
    expect(nextBarFrame(marks, 10, RATE)).toBe(BAR);
    expect(nextBarFrame(marks, BAR + 10, RATE)).toBe(BAR + 1_000);
    expect(nextBarFrame(marks, BAR + 1_010, RATE)).toBe(BAR + 1_000 + 128_000);
  });

  it("keeps a bounded, ordered list of marks", () => {
    let marks = withTempoMark([], { frame: 0, bpm: 120 });
    for (let index = 1; index <= 20; index += 1) marks = withTempoMark(marks, { frame: index * BAR, bpm: 120 });
    expect(marks).toHaveLength(MAX_TEMPO_MARKS);
    // A new play announces a start before the old marks: they are dropped.
    expect(withTempoMark(marks, { frame: 50, bpm: 100 })).toEqual([{ frame: 50, bpm: 100 }]);
  });
});
