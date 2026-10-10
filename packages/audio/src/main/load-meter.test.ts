// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest, Program } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { LoadMeter, averageUnits, calibrationFromRuns } from "./load-meter";

const manifest = (name: string, costPerVoice: number) =>
  ({ name, costPerVoice }) as unknown as InstrumentManifest;

const instruments = [manifest("bass", 1.4), manifest("hat", 0.6), manifest("kick", 1)];

const program = (tracks: [string, string][]) =>
  ({ tracks: tracks.map(([name, instrument]) => ({ name, instrument })) }) as unknown as Program;

/** [name, activeVoices now, voiceFrames so far] per instance, read at `frame`. */
const stats = (frame: number, instances: [string, number, number][]) => ({
  frame,
  lateDrops: 0,
  queueDrops: 0,
  nanResets: 0,
  unknownMessages: 0,
  unknownTargets: 0,
  instances: instances.map(([name, activeVoices, voiceFrames]) => ({
    name,
    activeVoices,
    onsetCount: 0,
    lastOnsetFrame: 0,
    voiceFrames,
  })),
});

describe("calibrationFromRuns", () => {
  it("splits the fixed cost from the cost per unit", () => {
    const calibration = calibrationFromRuns(
      { renderMs: 25, audioSeconds: 0.5 },
      { renderMs: 260, audioSeconds: 2, units: 24 },
    );
    expect(calibration.fixedFraction).toBeCloseTo(0.05);
    expect(calibration.fractionPerUnit).toBeCloseTo(0.08 / 24);
  });
});

describe("LoadMeter", () => {
  it("reads null and uncalibrated before calibration (CPU ~)", () => {
    const meter = new LoadMeter(instruments);
    expect(meter.current()).toEqual({ fraction: null, calibrated: false });
    expect(meter.estimate(program([["k", "kick"]]))).toEqual({ units: 1, fraction: null });
  });

  it("weighs the average voices between two readings by the instrument cost", () => {
    const meter = new LoadMeter(instruments);
    meter.calibrate({ fixedFraction: 0.1, fractionPerUnit: 0.01 });
    meter.track(program([["sub", "bass"], ["kick", "kick"], ["ride", "hat"]]));
    meter.observe(stats(1000, [["sub", 2, 2000], ["kick", 1, 500], ["ride", 0, 0], ["gone", 4, 4000]]));
    expect(meter.current().calibrated).toBe(true);
    // Since frame 0: sub 2 voices, kick 0.5.
    expect(meter.current().fraction).toBeCloseTo(0.1 + (2 * 1.4 + 0.5 * 1) * 0.01);
    // The next 1000 frames: sub 1 voice, kick 1.5 voices; the instantaneous count is ignored.
    meter.observe(stats(2000, [["sub", 0, 3000], ["kick", 0, 2000], ["ride", 0, 0]]));
    expect(meter.current().fraction).toBeCloseTo(0.1 + (1 * 1.4 + 1.5 * 1) * 0.01);
  });

  it("counts a reused slot from zero and falls back to active voices without elapsed frames", () => {
    const cost = () => 1;
    expect(averageUnits(stats(1000, [["a", 1, 900]]), stats(2000, [["a", 1, 300]]), cost)).toBeCloseTo(0.3);
    expect(averageUnits(stats(1000, [["a", 1, 900]]), stats(1000, [["a", 3, 900]]), cost)).toBe(3);
  });

  it("measures the units of a whole render for the calibration", () => {
    const meter = new LoadMeter(instruments);
    const units = meter.unitsOf(program([["k1", "kick"], ["h1", "hat"]]), stats(4000, [["k1", 1, 6000], ["h1", 0, 2000]]));
    expect(units).toBeCloseTo(1.5 * 1 + 0.5 * 0.6);
  });

  it("estimates a program before it plays", () => {
    const meter = new LoadMeter(instruments);
    meter.calibrate({ fixedFraction: 0, fractionPerUnit: 0.5 });
    const estimate = meter.estimate(program([["a", "bass"], ["b", "bass"], ["c", "pad"]]));
    expect(estimate.units).toBeCloseTo(2.8);
    expect(estimate.fraction).toBeCloseTo(1.4);
  });
});
