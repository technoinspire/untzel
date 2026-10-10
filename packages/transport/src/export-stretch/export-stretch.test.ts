// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { rational } from "@untzel/core";
import { describe, expect, it } from "vitest";
import {
  MIN_STRETCH_TICKS,
  TICKS_PER_BAR,
  barBeatLabel,
  barBeatOf,
  clampStretch,
  moveStretchHandle,
  secondsAtTick,
  snapTick,
  stretchKeyTick,
  stretchOfPlayRange,
  stretchSeconds,
  tickAtSeconds,
  trimStretchToCap,
  type StretchLimits,
  type TimeMap,
} from "./export-stretch";
import { exportTimeMap } from "./export-stretch-time";
import { fakeProgram, fakeSection, fakeTrack } from "../testing";

/** 120 BPM: two seconds a bar, so seconds read easily. */
const at120: TimeMap = [{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }];
const limits = (capSeconds: number, isFine = false, lastBar = 64): StretchLimits => ({ lastBar, map: at120, capSeconds, isFine });

describe("export stretch: ticks of 1/64 bar", () => {
  it("copies a play range, or takes the whole ruler", () => {
    expect(stretchOfPlayRange({ startBar: 9, endBar: 28 }, 56)).toEqual({ startTick: 512, endTick: 1792 });
    expect(stretchOfPlayRange(null, 8)).toEqual({ startTick: 0, endTick: 512 });
    expect(stretchOfPlayRange({ startBar: 3, endBar: 12 }, 8)).toEqual({ startTick: 128, endTick: 512 });
  });

  it("snaps to the step grid, or to 1/64 with Fine", () => {
    expect(snapTick(129, false)).toBe(128);
    expect(snapTick(130, false)).toBe(132);
    expect(snapTick(129, true)).toBe(129);
  });

  it("converts ticks and seconds both ways, across a tempo change", () => {
    expect(secondsAtTick(at120, 96)).toBe(3);
    expect(tickAtSeconds(at120, 3)).toBe(96);
    const song: TimeMap = [
      { startBar: 0, startSeconds: 0, secondsPerBar: 2 },
      { startBar: 4, startSeconds: 8, secondsPerBar: 1 },
    ];
    expect(secondsAtTick(song, 5 * TICKS_PER_BAR)).toBe(9);
    expect(tickAtSeconds(song, 9)).toBe(5 * TICKS_PER_BAR);
    expect(stretchSeconds(song, { startTick: 3 * TICKS_PER_BAR, endTick: 6 * TICKS_PER_BAR })).toBe(4);
  });

  it("moves a handle to the grid, a bar away from the other one at least", () => {
    const stretch = { startTick: 128, endTick: 512 };
    expect(moveStretchHandle(stretch, "start", 141, limits(600))).toEqual({ stretch: { startTick: 140, endTick: 512 }, isCapped: false });
    expect(moveStretchHandle(stretch, "start", 500, limits(600)).stretch.startTick).toBe(512 - MIN_STRETCH_TICKS);
    expect(moveStretchHandle(stretch, "end", 130, limits(600)).stretch.endTick).toBe(128 + MIN_STRETCH_TICKS);
    expect(moveStretchHandle(stretch, "end", 99_999, limits(600, false, 8)).stretch.endTick).toBe(512);
    expect(moveStretchHandle(stretch, "start", -40, limits(600)).stretch.startTick).toBe(0);
  });

  it("stops the moved handle at the cap and says so", () => {
    // 1:00 at 120 BPM is 30 bars: from bar 3 (tick 128) the end stops at tick 128 + 1920.
    const story = moveStretchHandle({ startTick: 128, endTick: 512 }, "end", 64 * 50, limits(60));
    expect(story).toEqual({ stretch: { startTick: 128, endTick: 2048 }, isCapped: true });
    const back = moveStretchHandle({ startTick: 1920, endTick: 3968 }, "start", 0, limits(60));
    expect(back).toEqual({ stretch: { startTick: 2048, endTick: 3968 }, isCapped: true });
    expect(stretchSeconds(at120, story.stretch)).toBe(60);
  });

  it("steps by one step on an arrow, one bar with Shift, and lands on the grid from off it", () => {
    expect(stretchKeyTick("ArrowRight", false, 128, false, 8)).toBe(132);
    expect(stretchKeyTick("ArrowRight", false, 128, true, 8)).toBe(129);
    expect(stretchKeyTick("ArrowLeft", true, 128, false, 8)).toBe(64);
    expect(stretchKeyTick("ArrowRight", false, 129, false, 8)).toBe(132);
    expect(stretchKeyTick("ArrowLeft", false, 129, false, 8)).toBe(128);
    expect(stretchKeyTick("End", false, 129, false, 8)).toBe(512);
    expect(stretchKeyTick("a", false, 129, false, 8)).toBeNull();
  });

  it("trims the end to a smaller cap, switching to the Story", () => {
    const long = { startTick: 0, endTick: 64 * 56 };
    expect(trimStretchToCap(long, at120, 60, false)).toEqual({ stretch: { startTick: 0, endTick: 1920 }, isCapped: true });
    expect(trimStretchToCap({ startTick: 0, endTick: 512 }, at120, 60, false).isCapped).toBe(false);
  });

  it("cuts a stretch to a shorter ruler and keeps it one bar long", () => {
    expect(clampStretch({ startTick: 400, endTick: 900 }, 8)).toEqual({ startTick: 400, endTick: 512 });
    expect(clampStretch({ startTick: 500, endTick: 900 }, 8)).toEqual({ startTick: 448, endTick: 512 });
    expect(clampStretch({ startTick: 0, endTick: 10 }, 8)).toEqual({ startTick: 0, endTick: 64 });
  });

  it("names a position as bar.beat, with the step and the 1/64 when needed", () => {
    expect(barBeatOf(168)).toEqual({ bar: 3, beat: 3, step: 3, fine: 0 });
    expect(barBeatLabel(128)).toBe("3.1");
    expect(barBeatLabel(144)).toBe("3.2");
    expect(barBeatLabel(168)).toBe("3.3.3");
    expect(barBeatLabel(169)).toBe("3.3.3+1/64");
  });

  it("reads the clock from the program: the loop's tempo, or a segment per tempo change in the song", () => {
    const loop = fakeProgram([fakeTrack("kick")], { tempo: 120 });
    expect(exportTimeMap(loop, "loop")).toEqual([{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }]);
    const sections = [fakeSection("intro", ["kick"]), { ...fakeSection("drop", ["kick"]), tempo: rational(240n, 1n) }];
    const song = fakeProgram([fakeTrack("kick")], {
      tempo: 120,
      sections,
      song: { parts: [{ section: "intro", bars: 4 }, { section: "drop", bars: 8 }], loop: false },
    });
    expect(exportTimeMap(song, "song")).toEqual([
      { startBar: 0, startSeconds: 0, secondsPerBar: 2 },
      { startBar: 4, startSeconds: 8, secondsPerBar: 1 },
    ]);
  });
});
