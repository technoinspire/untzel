// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { FPS } from "./frame-time";
import { MAX_TRAVEL_FRAMES, MIN_TRAVEL_FRAMES, burstTexts, burstWaitFrames, cursorPath, keyFrames, travelFrames } from "./gesture-schedule";

describe("the gesture schedule", () => {
  it("travels further in more frames, never a jump nor a crawl", () => {
    expect(travelFrames({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(MIN_TRAVEL_FRAMES);
    expect(travelFrames({ x: 0, y: 0 }, { x: 5_000, y: 0 })).toBe(MAX_TRAVEL_FRAMES);
  });
  it("moves the cursor out fast and lands on the control", () => {
    const path = cursorPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 6);
    expect(path).toHaveLength(6);
    expect(path.at(-1)).toEqual({ x: 100, y: 50 });
    const steps = path.map((point, index) => point.x - (path[index - 1]?.x ?? 0));
    expect(steps.every((step, index) => index === 0 || step <= (steps[index - 1] ?? Infinity))).toBe(true);
  });
  it("types at the demo's speed, the fractions carried over", () => {
    const waits = keyFrames("section intro", 12);
    expect(waits).toHaveLength(13);
    expect(waits.reduce((sum, wait) => sum + wait, 0)).toBe(Math.round((13 * FPS) / 12));
  });
  it("cuts a line into bursts of whole words, a line break on its own", () => {
    expect(burstTexts("hat: hat ..x. ..x. | gain 0.5")).toEqual(["hat: hat ", "..x. ..x. ", "| gain 0.5"]);
    expect(burstTexts("\nsection drop kick")).toEqual(["\n", "section ", "drop kick"]);
    expect(burstTexts("x").join("")).toBe("x");
    expect(burstWaitFrames(8, 120)).toBe(2);
    expect(burstWaitFrames(1, 120)).toBe(1);
  });
});
