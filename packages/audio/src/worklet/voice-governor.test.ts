// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { MAX_POOL_VOICES, UNLIMITED, VoiceGovernor, type VoiceControl } from "./voice-governor";

/** A fake engine: each slot plays `wanted` voices unless a limit caps it. */
class FakeEngine implements VoiceControl {
  readonly wanted: number[];
  readonly limits: number[];
  readonly calls: [number, number][] = [];

  constructor(wanted: number[]) {
    this.wanted = wanted;
    this.limits = wanted.map(() => UNLIMITED);
  }

  activeVoices(slot: number): number {
    const limit = this.limits[slot] ?? UNLIMITED;
    const wanted = this.wanted[slot] ?? 0;
    return limit === UNLIMITED ? wanted : Math.min(wanted, limit);
  }

  limitVoices(slot: number, maxVoices: number): void {
    this.limits[slot] = maxVoices;
    this.calls.push([slot, maxVoices]);
  }

  units(costs: readonly number[]): number {
    return this.wanted.reduce((sum, _, slot) => sum + this.activeVoices(slot) * (costs[slot] ?? 0), 0);
  }
}

/** Four tracks on slots 0..3, cost 1 per voice, capacity 10 units (fraction 0.1 per unit). */
function setup(wanted: number[], gains = [0.9, 0.3, 0.6, 0.3]) {
  const engine = new FakeEngine(wanted);
  const governor = new VoiceGovernor();
  const costs = wanted.map(() => 1);
  governor.setBudget({ fixedFraction: 0, fractionPerUnit: 0.1, costs });
  governor.configure(gains.map((gain, slot) => ({ slot, instrumentId: slot, gain })));
  return { engine, governor, load: () => engine.units(costs) * 0.1 };
}

describe("VoiceGovernor", () => {
  it("does nothing without a budget", () => {
    const engine = new FakeEngine([8, 8, 8, 8]);
    const governor = new VoiceGovernor();
    governor.configure([0, 1, 2, 3].map((slot) => ({ slot, instrumentId: 0, gain: 0.5 })));
    governor.step(engine);
    expect(engine.calls).toEqual([]);
  });

  it("above 100% takes voices from the quietest tracks, the last in the text first, down to 90%", () => {
    const { engine, governor, load } = setup([4, 4, 4, 4]);
    expect(load()).toBeCloseTo(1.6);
    governor.step(engine);
    expect(load()).toBeLessThanOrEqual(0.9 + 1e-9);
    // Track 3 (gain 0.3, last) loses first, then track 1 (gain 0.3), then 2 (0.6), then 0.
    expect(engine.calls.slice(0, 4)).toEqual([
      [3, 3],
      [1, 3],
      [2, 3],
      [0, 3],
    ]);
  });

  it("never takes the last voice of a track", () => {
    const { engine, governor } = setup([12, 12, 12, 12]);
    // A device so small that one voice per track is already above 100%.
    governor.setBudget({ fixedFraction: 0, fractionPerUnit: 0.3, costs: [1, 1, 1, 1] });
    governor.step(engine);
    expect(engine.limits).toEqual([1, 1, 1, 1]);
  });

  it("between 70% and 100% leaves the quotas alone; under 70% gives one voice back per step, loudest first", () => {
    const { engine, governor } = setup([4, 4, 4, 4]);
    governor.step(engine);
    const after = [...engine.calls];
    governor.step(engine);
    expect(engine.calls).toEqual(after);
    engine.wanted.fill(1);
    governor.step(engine);
    expect(engine.calls.length).toBe(after.length + 1);
    expect(engine.calls.at(-1)?.[0]).toBe(0);
  });

  it("a quota that reaches the largest pool becomes no quota", () => {
    const { engine, governor } = setup([40, 1, 1, 1]);
    governor.step(engine);
    expect(governor.quotaAt(0)).toBeGreaterThan(0);
    engine.wanted.fill(0);
    for (let step = 0; step < MAX_POOL_VOICES; step += 1) governor.step(engine);
    expect(governor.quotaAt(0)).toBe(UNLIMITED);
    expect(engine.limits[0]).toBe(UNLIMITED);
  });

  it("keeps the quota of a slot the next program keeps", () => {
    const { engine, governor } = setup([4, 4, 4, 4]);
    governor.step(engine);
    const quota = governor.quotaAt(3);
    governor.configure([{ slot: 3, instrumentId: 3, gain: 0.3 }]);
    expect(governor.quotaAt(0)).toBe(quota);
  });
});
