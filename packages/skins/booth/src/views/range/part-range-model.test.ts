// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { listHint, partPlayFromNote, partRangeStates, playFromNote } from "./part-range-model";

const PARTS = [
  { section: "intro", bars: 8, start: 0 },
  { section: "build", bars: 4, start: 8 },
  { section: "drop", bars: 16, start: 12 },
  { section: "break", bars: 8, start: 28 },
];
const range = (startBar: number, endBar: number) => ({ startBar, endBar, cycle: true });

describe("part rows and the play range", () => {
  it("marks start, end, inside and outside, and offers To here only outside", () => {
    const rows = partRangeStates(PARTS, range(9, 28));
    expect(rows.map((row) => row.role)).toEqual(["outside", "start", "end", "outside"]);
    expect(rows.map((row) => row.text)).toEqual([null, "Start · bar 9", "End · bar 28", null]);
    expect(rows.map((row) => row.canExtend)).toEqual([true, false, false, true]);
    expect(partRangeStates(PARTS, range(1, 36))[1]?.role).toBe("inside");
  });

  it("names every button, and presses the Play of the part that repeats alone", () => {
    const rows = partRangeStates(PARTS, range(13, 28));
    expect(rows[2]).toMatchObject({ role: "both", text: "bars 13–28", isPlayPressed: true, playLabel: "Play drop only", setLabel: "Set range to drop" });
    expect(rows[3]?.extendLabel).toBe("To here: extend the range to break");
    expect(partRangeStates(PARTS, null).every((row) => row.role === "none" && !row.isPlayPressed && !row.canExtend)).toBe(true);
  });

  it("the list hint and the part editor's note", () => {
    expect(listHint(true).visible).toBe("starts the range at a part. To here extends it.");
    expect(listHint(false).accessible).toBe("The bracket button starts the range at a part.");
    expect(playFromNote(range(9, 28), PARTS[2]!, 36)).toBe("Play from here moves the range start to bar 13, on the next bar.");
    expect(playFromNote(range(9, 12), PARTS[3]!, 36)).toBe("Play from here plays bars 29 to 36, on the next bar.");
    expect(playFromNote(null, PARTS[2]!, 36)).toBe("Play from here plays the song from bar 13, on the next bar.");
    // The loop's ruler: no song range, the song ends at its last part.
    expect(partPlayFromNote({ mode: "loop", range: range(3, 6), lastBar: 8 }, PARTS, PARTS[2]!)).toBe("Play from here plays the song from bar 13, on the next bar.");
    expect(partPlayFromNote({ mode: "song", range: range(9, 28), lastBar: 36 }, PARTS, PARTS[2]!)).toBe("Play from here moves the range start to bar 13, on the next bar.");
  });
});
