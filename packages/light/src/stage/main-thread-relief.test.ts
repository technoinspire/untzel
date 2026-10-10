// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { MainThreadRelief, RELIEF_WINDOW, SLOW_FRAMES_IN_WINDOW } from "./main-thread-relief";

const feed = (relief: MainThreadRelief, intervals: readonly number[]): number => intervals.reduce<number>((_, interval) => relief.record(interval), relief.level);

describe("main-thread relief", () => {
  it("stays at level 0 while the page keeps its frames, a late frame now and then included", () => {
    const relief = new MainThreadRelief();
    // One frame in three at 33 ms: the p95 of main with 64 tracks at CPU ×4.
    expect(feed(relief, Array.from({ length: 600 }, (_, frame) => (frame % 3 === 0 ? 33.3 : 16.7)))).toBe(0);
    // A hidden tab coming back: one very long interval.
    expect(relief.record(4_000)).toBe(0);
  });

  it("steps down one level when most frames of the window are late, and again if they stay late", () => {
    const relief = new MainThreadRelief();
    expect(feed(relief, Array.from({ length: SLOW_FRAMES_IN_WINDOW - 1 }, () => 33.3))).toBe(0);
    expect(relief.record(33.3)).toBe(1);
    // The window starts over: level 2 takes another run of late frames.
    expect(feed(relief, Array.from({ length: SLOW_FRAMES_IN_WINDOW - 1 }, () => 33.3))).toBe(1);
    expect(relief.record(50)).toBe(2);
    expect(feed(relief, Array.from({ length: 4 * RELIEF_WINDOW }, () => 66.7))).toBe(2);
  });

  it("never steps back up during a play; a new play starts at level 0", () => {
    const relief = new MainThreadRelief();
    feed(relief, Array.from({ length: SLOW_FRAMES_IN_WINDOW }, () => 33.3));
    expect(feed(relief, Array.from({ length: 10 * RELIEF_WINDOW }, () => 16.7))).toBe(1);
    relief.reset();
    expect(relief.level).toBe(0);
  });

  it("counts only the last window", () => {
    const relief = new MainThreadRelief();
    const late = Array.from({ length: SLOW_FRAMES_IN_WINDOW - 1 }, () => 33.3);
    const onTime = Array.from({ length: RELIEF_WINDOW }, () => 16.7);
    expect(feed(relief, [...late, ...onTime, ...late])).toBe(0);
  });
});
