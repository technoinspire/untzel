// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { PlayRangeView } from "@untzel/presentation/view-model";
import {
  barNumbers,
  barScale,
  editingBarsOnRuler,
  edgesOfSpan,
  handleLimits,
  handleValueText,
  keyTarget,
  moveHandle,
  playheadFraction,
  songTapSpan,
  spanOfEdges,
  startOfTap,
  tapBar,
  transportRulerView,
} from "./range-ruler-model";
import { edgeGeometry, handleForPointer } from "./ruler-geometry";

const SONG_PARTS = [
  { name: "intro", startBar: 1, endBar: 8 },
  { name: "build", startBar: 9, endBar: 12 },
  { name: "drop", startBar: 13, endBar: 28 },
  { name: "break", startBar: 29, endBar: 36 },
  { name: "build", startBar: 37, endBar: 40 },
  { name: "drop", startBar: 41, endBar: 56 },
];
const loop: Pick<PlayRangeView, "mode" | "range" | "lastBar" | "parts"> = { mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, lastBar: 8, parts: [] };

describe("range ruler geometry", () => {
  it("places bars 3–6 of 8 and the needle in the middle of bar 4", () => {
    expect(edgeGeometry(edgesOfSpan({ startBar: 3, endBar: 6 }), 8)).toEqual({ left: 0.25, width: 0.5 });
    expect(spanOfEdges({ start: 2, end: 6 })).toEqual({ startBar: 3, endBar: 6 });
    expect(playheadFraction(4, 8)).toBe(0.4375);
    expect(playheadFraction(null, 8)).toBeNull();
  });

  it("a drag snaps the handle to the bar under the pointer, and says it", () => {
    const scale = barScale(loop);
    expect(scale.drag("start", 2.08, false)).toEqual({ start: 2, end: 6 });
    expect(scale.drag("end", 7.9, false)).toEqual({ start: 2, end: 8 });
    expect(scale.drag("start", 7.5, false)).toEqual({ start: 5, end: 6 });
    expect(scale.dragLabel("start", { start: 2, end: 6 })).toBe("Start · bar 3");
    expect(scale.dragLabel("end", { start: 2, end: 6 })).toBe("End · bar 6");
    expect(scale.key("end", "ArrowRight", false)).toEqual({ start: 2, end: 7 });
    expect(scale.key("end", "q", false)).toBeNull();
  });
  it("picks the handle by the side of the middle, or under 12 px by the first move", () => {
    expect(handleForPointer(100, 90, 300, 8)).toBe("start");
    expect(handleForPointer(290, 90, 300, -8)).toBe("end");
    // A 1-bar range of a 16-bar loop at 390 px: the lines are 20 px apart, still sides.
    expect(handleForPointer(105, 100, 120, -7)).toBe("start");
    // Lines 8 px apart: the direction decides, so the range can grow to the left.
    expect(handleForPointer(104, 100, 108, -7)).toBe("start");
    expect(handleForPointer(104, 100, 108, 7)).toBe("end");
  });
  it("outlines every loop bar that plays the pattern bar in edit, none in a song", () => {
    expect(editingBarsOnRuler("loop", 8, { bar: 4, patternBars: 8 })).toEqual([5]);
    expect(editingBarsOnRuler("loop", 8, { bar: 1, patternBars: 4 })).toEqual([2, 6]);
    expect(editingBarsOnRuler("loop", 8, null)).toEqual([]);
    expect(editingBarsOnRuler("loop", 8, { bar: 0, patternBars: 1 })).toEqual([]);
    expect(editingBarsOnRuler("song", 56, { bar: 0, patternBars: 4 })).toEqual([]);
  });
  it("builds the ruler: band, handles, pending outline and the bar in edit", () => {
    const view = { ...loop, sounding: loop.range, playheadBar: 4, songNames: null };
    const ruler = transportRulerView(view, 2, { bar: 4, patternBars: 8 });
    expect(ruler).toMatchObject({ hasRange: true, edges: { start: 2, end: 6 }, pending: { start: 1, end: 2 }, editingBars: [5], playhead: 0.4375, isInert: false });
    expect(ruler.handles.end).toEqual({ min: 3, max: 8, now: 6, valueText: "End, bar 6 of 8" });
    expect(startOfTap({ mode: "song", parts: SONG_PARTS }, 20)).toBe(13);
  });
});

describe("range ruler handles", () => {
  it("one handle stops at the other; without a range they start at the ends", () => {
    expect(moveHandle({ startBar: 3, endBar: 6 }, "start", 7, 8)).toEqual({ startBar: 6, endBar: 6, cycle: true });
    expect(moveHandle({ startBar: 3, endBar: 6 }, "end", 2, 8)).toEqual({ startBar: 3, endBar: 3, cycle: true });
    expect(moveHandle(null, "start", 3, 8)).toEqual({ startBar: 3, endBar: 8, cycle: true });
    expect(moveHandle(null, "end", 5, 8)).toEqual({ startBar: 1, endBar: 5, cycle: true });
  });

  it("arrows move one bar, Shift and Page keys four, Home and End to the limits", () => {
    const { min, max } = handleLimits({ startBar: 3, endBar: 6 }, "end", 8);
    expect([min, max]).toEqual([3, 8]);
    expect(keyTarget("ArrowRight", false, 6, min, max)).toBe(7);
    expect(keyTarget("ArrowLeft", true, 6, min, max)).toBe(3);
    expect(keyTarget("PageUp", false, 6, min, max)).toBe(8);
    expect(keyTarget("Home", false, 6, min, max)).toBe(3);
    expect(keyTarget("End", false, 6, min, max)).toBe(8);
    expect(keyTarget("a", false, 6, min, max)).toBeNull();
  });

  it("says each handle in bars", () => {
    expect(handleValueText(loop, "start", 3)).toBe("Start, bar 3 of 8");
    expect(handleValueText(loop, "end", 6)).toBe("End, bar 6 of 8");
    expect(handleValueText({ ...loop, range: null }, "start", 1)).toBe("Start, bar 1 of 8, whole loop");
    const song = { mode: "song" as const, range: { startBar: 9, endBar: 28, cycle: true }, lastBar: 56, parts: SONG_PARTS };
    expect(handleValueText(song, "start", 9)).toBe("Start, bar 9 of 56, build");
  });
});

describe("two taps", () => {
  it("the first tap waits, the second closes the range in either order", () => {
    expect(tapBar(null, 3)).toEqual({ kind: "pending", bar: 3 });
    expect(tapBar(6, 3)).toEqual({ kind: "range", span: { startBar: 3, endBar: 6 } });
    expect(tapBar(4, 4)).toEqual({ kind: "range", span: { startBar: 4, endBar: 4 } });
  });

  it("in a song, taps mean parts: build then drop is bars 9–28", () => {
    expect(songTapSpan(SONG_PARTS, 10, 20)).toEqual({ startBar: 9, endBar: 28 });
    expect(songTapSpan(SONG_PARTS, 20, 10)).toEqual({ startBar: 9, endBar: 28 });
    expect(songTapSpan(SONG_PARTS, 99, 10)).toBeNull();
  });
});

describe("bar numbers", () => {
  it("the loop shows every bar, bold inside the range", () => {
    const marks = barNumbers("loop", 8, { startBar: 3, endBar: 6 }, []);
    expect(marks.map((mark) => mark.bar)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(marks.filter((mark) => mark.isStrong).map((mark) => mark.bar)).toEqual([3, 4, 5, 6]);
  });

  it("the song shows 1, the part starts, the range's ends and the last bar; 29 gives way to 28", () => {
    const marks = barNumbers("song", 56, { startBar: 9, endBar: 28 }, SONG_PARTS);
    expect(marks.map((mark) => mark.bar)).toEqual([1, 9, 13, 28, 37, 41, 56]);
    expect(marks.filter((mark) => mark.isStrong).map((mark) => mark.bar)).toEqual([9, 28]);
  });
});
