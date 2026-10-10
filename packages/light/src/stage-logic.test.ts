// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { latencyCompensatedClock } from "./stage/clock";
import { FRAME_BUDGET_MS, FrameBudget, SLOW_FRAMES_TO_DEGRADE } from "./stage/frame-budget";

describe("heard clock", () => {
  it("is the context time minus the output latency: a cue shows when its sound reaches the speaker", () => {
    let now = 10;
    const clock = latencyCompensatedClock(() => now, () => 0.04);
    expect(clock.heardTime()).toBeCloseTo(9.96, 9);
    now = 10.061;
    expect(clock.heardTime()).toBeGreaterThan(10.02);
  });
});

describe("frame budget", () => {
  it("lowers the light fallback first, then resolution, after 30 slow frames", () => {
    const budget = new FrameBudget();
    const slow = (): void => {
      for (let frame = 0; frame < SLOW_FRAMES_TO_DEGRADE; frame += 1) budget.record(FRAME_BUDGET_MS + 1);
    };
    slow();
    expect(budget.quality).toEqual({ particleScale: 0.5, resolutionScale: 1 });
    slow();
    slow();
    expect(budget.quality.resolutionScale).toBeLessThan(1);
  });

  it("one fast frame resets the count", () => {
    const budget = new FrameBudget();
    for (let frame = 0; frame < SLOW_FRAMES_TO_DEGRADE - 1; frame += 1) budget.record(20);
    budget.record(5);
    budget.record(20);
    expect(budget.quality.particleScale).toBe(1);
  });
});
