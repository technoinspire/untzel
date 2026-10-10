// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { contextClock, type ContextClockSource } from "./engine-clock";

function context(overrides: Partial<ContextClockSource> = {}): ContextClockSource {
  return { sampleRate: 48_000, state: "running", currentTime: 2, ...overrides };
}

describe("contextClock", () => {
  it("reads the sample rate and the seconds of the context", () => {
    const clock = contextClock(context({ sampleRate: 44_100, currentTime: 1.5 }));
    expect(clock.sampleRate).toBe(44_100);
    expect(clock.seconds()).toBe(1.5);
    expect(clock.nowFrame()).toBe(66_150);
  });
  it("has no output frame while the context is not running", () => {
    expect(contextClock(context({ state: "suspended" })).nowFrame()).toBeNull();
    expect(contextClock(context({ state: "closed" })).nowFrame()).toBeNull();
  });
  it("hears by the output timestamp, moved to this moment", () => {
    const clock = contextClock(
      context({ getOutputTimestamp: () => ({ contextTime: 1.9, performanceTime: 1_000 }), outputLatency: 0.04 }),
      () => 1_010,
    );
    expect(clock.heardTime()).toBeCloseTo(1.91, 10);
  });
  it("falls back to currentTime minus the latencies without a usable timestamp", () => {
    const latencies = { outputLatency: 0.03, baseLatency: 0.01 };
    expect(contextClock(context(latencies)).heardTime()).toBeCloseTo(1.96, 10);
    const zero = context({ ...latencies, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) });
    expect(contextClock(zero).heardTime()).toBeCloseTo(1.96, 10);
    expect(contextClock(context()).heardTime()).toBe(2);
  });
});
