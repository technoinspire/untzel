// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ExportStretchView } from "@untzel/presentation/view-model";
import { exportRulerView, exportScale, exportStretchState, stretchTicksOf } from "./export-stretch-model";

/** An 8-bar loop at 120 BPM (2 s a bar), bars 3–6 copied from the play range. */
const stretch: ExportStretchView = {
  mode: "loop",
  lastBar: 8,
  parts: [],
  startTick: 128,
  endTick: 384,
  timeMap: [{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }],
  capSeconds: 60,
  isFine: false,
  playheadBar: 4,
  isListening: false,
  hasPlayRange: true,
  isReset: true,
  playRangeLabel: null,
};

describe("export stretch state", () => {
  it("reads the start and the end as time and bar.beat, and offers the reset", () => {
    const state = exportStretchState({ ...stretch, startTick: 168, isReset: false }, "story", "hd");
    expect(state).toEqual({ readout: "0:05.3 · bar 3.3.3 → 0:12.0 · bar 7.1", capNote: "Story up to 1:00", resetLabel: "Use play range", isResetInert: false });
    expect(exportStretchState({ ...stretch, hasPlayRange: false }, "video", "hd").resetLabel).toBe("Use whole loop");
  });
});

describe("export ruler", () => {
  it("draws the band at the stretch and says each handle in time and bar.beat", () => {
    const ruler = exportRulerView({ ...stretch, startTick: 168 });
    expect(ruler.edges).toEqual({ start: 168 / 64, end: 6 });
    expect(ruler.hasRange).toBe(true);
    expect(ruler.playhead).toBe(0.4375);
    expect(ruler.handles.start).toEqual({ min: 0, max: 320, now: 168, valueText: "Start, 0:05.3, bar 3 beat 3 step 3" });
    expect(ruler.handles.end.valueText).toBe("End, 0:12.0, bar 7 beat 1");
    expect(ruler.numbers.filter((mark) => mark.isStrong).map((mark) => mark.bar)).toEqual([3, 4, 5, 6]);
  });
  it("writes the ruler's edges back as the stretch's ticks, rounded to a tick", () => {
    expect(stretchTicksOf({ start: 2.625, end: 6 })).toEqual({ start: 168, end: 384 });
    expect(stretchTicksOf({ start: 168 / 64 + 0.004, end: 6 - 0.004 })).toEqual({ start: 168, end: 384 });
  });
  it("drags by steps (1/64 with Fine or a held key) and stops at the cap", () => {
    const scale = exportScale(stretch);
    expect(scale.drag("start", 2.6, false)).toEqual({ start: 2.625, end: 6 });
    expect(scale.drag("start", 2.6, true)).toEqual({ start: 166 / 64, end: 6 });
    expect(exportScale({ ...stretch, isFine: true }).drag("start", 2.6, false)).toEqual({ start: 166 / 64, end: 6 });
    // 10 s cap from bar 3 (4 s in): the end stops at 14 s, bar 8 beat 1.
    expect(exportScale({ ...stretch, capSeconds: 10 }).drag("end", 8, false)).toEqual({ start: 2, end: 7 });
    expect(scale.dragLabel("start", { start: 2.625, end: 6 })).toBe("Start · 0:05.3 · 3.3.3");
  });
  it("moves a step per arrow and a bar with Shift", () => {
    const scale = exportScale(stretch);
    expect(scale.key("start", "ArrowRight", false)).toEqual({ start: 132 / 64, end: 6 });
    expect(scale.key("start", "ArrowRight", true)).toEqual({ start: 3, end: 6 });
    expect(scale.key("end", "ArrowLeft", true)).toEqual({ start: 2, end: 5 });
    expect(scale.key("end", "x", false)).toBeNull();
  });
});
