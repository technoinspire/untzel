// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { buildArrangement } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { clampPlayRange, createPlayRange, isInPlayRange, playFromBar, snapToBar } from "./play-range";
import { lastBarOf } from "./play-range-ruler";
import { extendRangeToPart, isRangeOfPart, partIndexAtBar, rangeOfPart, rangePartNames } from "./play-range-parts";
import { barAfterRangeChange, barWithoutRange, nextRangeBar, offsetForBar } from "./play-range-schedule";
import { playRangeStep, rulerBarBefore } from "./play-range-step";
import { fakeProgram, fakeSection, fakeTrack } from "../testing";

const range = (startBar: number, endBar: number, cycle = true) => ({ startBar, endBar, cycle });

/** An example song: intro 8, build 4, drop 16, break 8, build 4, drop 16 = 56 bars. */
function exampleArrangement() {
  const names = ["intro", "build", "drop", "break"];
  const program = fakeProgram([fakeTrack("kick")], {
    sections: names.map((name) => fakeSection(name, ["kick"])),
    song: {
      parts: [["intro", 8], ["build", 4], ["drop", 16], ["break", 8], ["build", 4], ["drop", 16]].map(([section, bars]) => ({ section: String(section), bars: Number(bars) })),
      loop: false,
    },
  });
  const arrangement = buildArrangement(program);
  if (arrangement === null) throw new Error("no arrangement");
  return { program, arrangement };
}

describe("play-range values", () => {
  it("creates a valid range and refuses each invalid one", () => {
    expect(createPlayRange(3, 6, true)).toEqual(range(3, 6));
    expect(createPlayRange(0, 6, true)).toEqual({ code: "INVALID_RANGE" });
    expect(createPlayRange(6, 3, true)).toEqual({ code: "INVALID_RANGE" });
    expect(createPlayRange(2.5, 6, true)).toEqual({ code: "INVALID_RANGE" });
  });

  it("clamps 3–6 to 3–4 against 4 bars and to 2–2 against 2, and leaves what fits", () => {
    expect(clampPlayRange(range(3, 6), 4)).toEqual({ range: range(3, 4), changed: true });
    expect(clampPlayRange(range(3, 6), 2)).toEqual({ range: range(2, 2), changed: true });
    const fits = range(3, 6);
    expect(clampPlayRange(fits, 8)).toEqual({ range: fits, changed: false });
  });

  it("snaps a ruler point to the bar under it, inside the ruler", () => {
    expect(snapToBar(0, 8)).toBe(1);
    expect(snapToBar(2.99, 8)).toBe(3);
    expect(snapToBar(8, 8)).toBe(8);
    expect(snapToBar(-1, 8)).toBe(1);
    expect(isInPlayRange(6, range(3, 6))).toBe(true);
    expect(isInPlayRange(7, range(3, 6))).toBe(false);
  });

  it("knows the last bar of each ruler", () => {
    const { program, arrangement } = exampleArrangement();
    expect(lastBarOf(fakeProgram([fakeTrack("kick")], { loopBars: 8 }), null, "loop")).toBe(8);
    expect(lastBarOf(program, arrangement, "song")).toBe(56);
    expect(lastBarOf(program, null, "song")).toBeNull();
  });

  it("Play from here moves only the start, in the four cases of the table", () => {
    expect(playFromBar(null, 3, 8, "loop")).toEqual(range(3, 8, true));
    expect(playFromBar(null, 13, 56, "song")).toEqual(range(13, 56, false));
    expect(playFromBar(range(9, 28), 13, 56, "song")).toEqual(range(13, 28, true));
    expect(playFromBar(range(9, 28, false), 37, 56, "song")).toEqual(range(37, 56, false));
  });
});

describe("play-range parts", () => {
  it("a part is its bars; To here extends before and after", () => {
    const { arrangement } = exampleArrangement();
    expect(rangeOfPart(arrangement, 1, true)).toEqual(range(9, 12));
    expect(rangeOfPart(arrangement, 9, true)).toBeNull();
    expect(extendRangeToPart(range(9, 12), arrangement, 2)).toEqual(range(9, 28));
    expect(extendRangeToPart(range(9, 28), arrangement, 0)).toEqual(range(1, 28));
    expect(extendRangeToPart(null, arrangement, 3)).toEqual(range(29, 36));
    expect(isRangeOfPart(range(13, 28), arrangement, 2)).toBe(true);
    expect(isRangeOfPart(range(9, 28), arrangement, 2)).toBe(false);
  });

  it("names the ends on part boundaries, says when a name repeats, null elsewhere", () => {
    const { arrangement } = exampleArrangement();
    expect(rangePartNames(range(9, 28), arrangement)).toEqual({ first: "build", last: "drop", repeated: true, single: false });
    expect(rangePartNames(range(29, 36), arrangement)).toEqual({ first: "break", last: "break", repeated: false, single: true });
    expect(rangePartNames(range(10, 28), arrangement)).toBeNull();
    expect(partIndexAtBar(arrangement, 9)).toBe(1);
    expect(partIndexAtBar(arrangement, 57)).toBeNull();
  });
});

describe("play-range schedule", () => {
  it("barWithoutRange: the loop shrank behind the bar, the end of the song", () => {
    expect(barWithoutRange(6, 4, "loop", false)).toEqual({ kind: "bar", bar: 1, jumped: false });
    expect(barWithoutRange(8, 8, "loop", false)).toEqual({ kind: "bar", bar: 1, jumped: false });
    expect(barWithoutRange(56, 56, "song", false)).toEqual({ kind: "end" });
    expect(barWithoutRange(56, 56, "song", true)).toEqual({ kind: "bar", bar: 1, jumped: false });
    expect(barWithoutRange(60, 56, "song", false)).toEqual({ kind: "end" });
  });

  it("nextRangeBar: wraps inside, null is the plain advance, outside goes to the start", () => {
    expect(nextRangeBar(6, range(3, 6), 8, "loop", false)).toEqual({ kind: "bar", bar: 3, jumped: false });
    expect(nextRangeBar(4, null, 8, "loop", false)).toEqual(barWithoutRange(4, 8, "loop", false));
    expect(nextRangeBar(6, range(3, 4), 4, "loop", false)).toEqual({ kind: "bar", bar: 3, jumped: true });
    expect(nextRangeBar(28, range(9, 28, false), 56, "song", false)).toEqual({ kind: "bar", bar: 29, jumped: false });
    expect(nextRangeBar(56, range(9, 28, false), 56, "song", false)).toEqual({ kind: "end" });
    expect(nextRangeBar(56, range(9, 28, false), 56, "song", true)).toEqual({ kind: "bar", bar: 1, jumped: false });
    // Loop mode always cycles, whatever cycle says.
    expect(nextRangeBar(6, range(3, 6, false), 8, "loop", false)).toEqual({ kind: "bar", bar: 3, jumped: false });
  });

  it("barAfterRangeChange: one case per rule", () => {
    const base = { lastBar: 8, mode: "loop" as const, songLoops: false, locate: false };
    // 3: the end moves 6 → 8 while 6 plays: 7 is inside.
    expect(barAfterRangeChange({ ...base, current: 6, previous: range(3, 6), next: range(3, 8) })).toEqual({ kind: "bar", bar: 7, jumped: false });
    // 1: cleared on 6 plays 7.
    expect(barAfterRangeChange({ ...base, current: 6, previous: range(3, 6), next: null })).toEqual({ kind: "bar", bar: 7, jumped: false });
    expect(barAfterRangeChange({ ...base, current: 4, previous: range(3, 6), next: range(5, 8) })).toEqual({ kind: "bar", bar: 5, jumped: false });
    // 5: outside → the start.
    expect(barAfterRangeChange({ ...base, current: 4, previous: range(3, 6), next: range(6, 8) })).toEqual({ kind: "bar", bar: 6, jumped: true });
    const song = { lastBar: 56, mode: "song" as const, songLoops: false };
    // 2: locate always goes to the start, even from inside.
    expect(barAfterRangeChange({ ...song, current: 17, previous: range(9, 28), next: range(13, 28), locate: true })).toEqual({ kind: "bar", bar: 13, jumped: true });
    // 4: Cycle off, same start, only the end moved: plays on.
    expect(barAfterRangeChange({ ...song, current: 45, previous: range(9, 28, false), next: range(9, 30, false), locate: false })).toEqual({ kind: "bar", bar: 46, jumped: false });
    // Cycle on again at 45 jumps to 9.
    expect(barAfterRangeChange({ ...song, current: 45, previous: range(9, 28, false), next: range(9, 28, true), locate: false })).toEqual({ kind: "bar", bar: 9, jumped: true });
    // A new Cycle-off range while the music is outside jumps to its start.
    expect(barAfterRangeChange({ ...song, current: 45, previous: null, next: range(9, 28, false), locate: false })).toEqual({ kind: "bar", bar: 9, jumped: true });
  });

  it("offsetForBar puts the ruler bar on the absolute bar", () => {
    expect(offsetForBar(10, 3)).toBe(8);
    expect(rulerBarBefore(10, 8, 8, true)).toBe(2);
    expect(rulerBarBefore(10, 0, 8, true)).toBe(2);
    expect(rulerBarBefore(10, 0, 56, false)).toBe(10);
    expect(rulerBarBefore(0, 0, 8, true)).toBeNull();
  });
});

describe("play-range step", () => {
  const input = {
    mode: "loop" as const,
    bar: 20,
    current: 6,
    lastBar: 8,
    songLoops: false,
    range: range(3, 6),
    change: null,
    modeChanged: false,
    ownsPass: true,
  };

  it("without a range or a change, and not owning the pass, keeps the transport's own advance", () => {
    expect(playRangeStep({ ...input, range: null, ownsPass: false })).toEqual({ kind: "keep" });
    expect(playRangeStep({ ...input, lastBar: null })).toEqual({ kind: "keep" });
  });

  it("wraps the range by moving the pass offset, and keeps owning the pass", () => {
    expect(playRangeStep(input)).toEqual({ kind: "move", offset: 20 - 2, ownsPass: true });
  });

  it("a mode change enters at the range start", () => {
    expect(playRangeStep({ ...input, modeChanged: true, current: null })).toEqual({ kind: "move", offset: 18, ownsPass: true });
    expect(playRangeStep({ ...input, mode: "song", modeChanged: true, range: null })).toEqual({ kind: "keep" });
  });

  it("the song's end moves the arrangement bar to its length", () => {
    expect(playRangeStep({ ...input, mode: "song", current: 56, lastBar: 56, range: null, change: { previous: range(9, 28), locate: false } })).toEqual({ kind: "move", offset: 20 - 56, ownsPass: false });
  });
});
