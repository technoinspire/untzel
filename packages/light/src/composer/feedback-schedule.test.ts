// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { EXPORT_PRE_ROLL_S, GRID_STEPS_PER_BAR, STAGE_PRE_ROLL_S, TRAIL_HALF_LIFE_S, partialStep, trailDecay, trailSteps } from "./feedback-schedule";
import { MusicalClock } from "../stage/musical-clock";
// The trail's grid: 1/96 of a bar of audio time, whatever the frame rate, so the
// stage at 144 fps and the export at 30 fps step the same buffer the same way.

const SECONDS_PER_BAR = 2;

function clock(): MusicalClock {
  const value = new MusicalClock();
  for (let bar = 0; bar <= 8; bar += 1) value.add({ audioTime: bar * SECONDS_PER_BAR, bar, secondsPerBar: SECONDS_PER_BAR, section: null });
  return value;
}

describe("feedback schedule", () => {
  it("steps every 1/96 of a bar, the same steps however the span is cut", () => {
    const steps = trailSteps(clock(), 0, SECONDS_PER_BAR, 7);
    expect(steps).toHaveLength(GRID_STEPS_PER_BAR);
    for (const step of steps) expect(step.seconds).toBeCloseTo(SECONDS_PER_BAR / GRID_STEPS_PER_BAR, 12);
    // A 144 fps stage asks frame by frame; the export asks once a frame at 30 fps.
    const live: number[] = [];
    for (let frame = 0; frame < 144 * SECONDS_PER_BAR; frame += 1) live.push(...trailSteps(clock(), frame / 144, (frame + 1) / 144, 7).map((step) => step.time));
    const exported: number[] = [];
    for (let frame = 0; frame < 30 * SECONDS_PER_BAR; frame += 1) exported.push(...trailSteps(clock(), frame / 30, (frame + 1) / 30, 7).map((step) => step.time));
    expect(live).toEqual(exported);
  });

  it("halves the trail every 60 ms and contracts it towards the core at every step", () => {
    expect(trailDecay(TRAIL_HALF_LIFE_S)).toBeCloseTo(0.5, 12);
    for (const step of trailSteps(clock(), 0, 4, 7)) {
      expect(step.zoom).toBeLessThan(1);
      expect(Math.abs(step.turn)).toBeLessThanOrEqual(0.05 * step.seconds + 1e-12);
    }
  });

  it("leaves under 1/255 of a frame after the pre-roll, so a jump rebuilds the same trail", () => {
    expect(trailDecay(STAGE_PRE_ROLL_S)).toBeLessThan(1 / 255);
    expect(trailDecay(EXPORT_PRE_ROLL_S)).toBeLessThan(1e-4);
  });

  it("joins the partial step to the next grid step without a jump", () => {
    const [first, second] = trailSteps(clock(), 0, 0.05, 7);
    if (first === undefined || second === undefined) throw new Error("two steps expected");
    expect(partialStep(first, first.time)).toMatchObject({ seconds: 0, decay: 1, zoom: 1, turn: 0 });
    const end = partialStep(first, second.time);
    expect(end.seconds).toBeCloseTo(second.seconds, 12);
    expect(end.decay).toBeCloseTo(second.decay, 12);
  });

  it("is a pure function of the plan's hash", () => {
    expect(trailSteps(clock(), 0, 2, 7)).toEqual(trailSteps(clock(), 0, 2, 7));
    expect(trailSteps(clock(), 0, 2, 7).map((step) => step.turn)).not.toEqual(trailSteps(clock(), 0, 2, 8).map((step) => step.turn));
  });
});
