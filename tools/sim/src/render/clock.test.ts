// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { clockOf } from "./clock";

// Spins until this thread has accrued `cpuMilliseconds` of CPU, with a wall-time ceiling.
// Spinning for a fixed wall time made the test flaky on a loaded machine: the thread spent
// most of those 30 ms off the core and accrued under 5 ms of CPU, which is exactly what the
// cpu clock exists to report. The assertion below is unchanged.
function busyFor(cpu: () => number, cpuMilliseconds: number, wallCeiling: number): void {
  const start = cpu();
  const until = performance.now() + wallCeiling;
  while (cpu() - start <= cpuMilliseconds && performance.now() < until) Math.sqrt(Math.random());
}

describe("clockOf", () => {
  it("cpu advances while this thread computes and stays put while it sleeps", async () => {
    const cpu = clockOf("cpu");
    const start = cpu();
    busyFor(cpu, 6, 5000);
    expect(cpu() - start).toBeGreaterThan(5);
    const beforeSleep = cpu();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cpu() - beforeSleep).toBeLessThan(20);
  });

  it("wall follows elapsed time", async () => {
    const wall = clockOf("wall");
    const start = wall();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(wall() - start).toBeGreaterThanOrEqual(25);
  });
});
