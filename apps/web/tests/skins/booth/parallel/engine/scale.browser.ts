// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The scale test: 1, 8, 16, 32 and 64 tracks (kick, hat, bass
// alternating), the CPU meter against CDP renderCapacity, underruns while the
// meter is below 1.0, every counter at zero and the kick on its exact frame.
// Plus one line per synthesis engine:
// eight tracks of the engine's most expensive instrument, the live meter against
// renderCapacity in the same tolerance. The sim side (pnpm sim --scale) is the gate; this
// confirms the worklet meter reads the new engines true.

import { expect, test } from "@playwright/test";
import { counters, kickDrift, measurementSuite, read, tapAndWait, webAudio, writeMeasurement } from "../../support/measure-support";

measurementSuite();

const SCALE_TRACKS = [1, 8, 16, 32, 64];
/**
 * One instrument per engine, the costliest of each (tools/sim engineRepresentatives:
 * costPerVoice × voices). ENGINE_TRACKS = 8 tracks each, built by ?stressEngine=<name>.
 */
const ENGINE_REPRESENTATIVES = ["supersaw", "hat", "epiano", "piano", "clap", "choir", "pluck", "organ"] as const;
const SAMPLE_SECONDS = 10;
const results: Record<string, unknown> = {};

test.afterAll(() => writeMeasurement("scale", results));

/** 15% relative, or 0.015 absolute below 0.1. */
function withinTolerance(meter: number, capacity: number): boolean {
  const difference = Math.abs(meter - capacity);
  return difference <= 0.15 * capacity || (capacity < 0.1 && difference <= 0.015);
}

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

interface Measured {
  readonly renderCapacity: number | null;
  readonly meter: number | null;
  readonly within: boolean | null;
  readonly underruns: number | null;
  readonly after: Awaited<ReturnType<typeof read>>;
  readonly calibration: unknown;
}

/** Loads `url`, waits for calibration, then averages the meter against renderCapacity. */
async function measure(page: import("@playwright/test").Page, url: string): Promise<Measured> {
  const audio = await webAudio(page);
  await page.goto(url);
  await tapAndWait(page);
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest: { calibrated(): boolean } }).untzelTest.calibrated(), undefined, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1000);
  const before = await read(page);
  const capacities: number[] = [];
  const meters: number[] = [];
  for (let index = 0; index < SAMPLE_SECONDS * 4; index += 1) {
    await page.waitForTimeout(250);
    const capacity = await audio.renderCapacity();
    if (capacity !== null) capacities.push(capacity);
    const meter = (await read(page)).meter;
    if (meter !== null) meters.push(meter);
  }
  const after = await read(page);
  const calibration = await page.evaluate(() => (globalThis as unknown as { untzelTest: { calibration(): unknown } }).untzelTest.calibration());
  const capacity = mean(capacities);
  const meter = mean(meters);
  return {
    renderCapacity: capacity,
    meter,
    within: capacity === null || meter === null ? null : withinTolerance(meter, capacity),
    underruns: after.underruns === null || before.underruns === null ? null : after.underruns - before.underruns,
    after,
    calibration,
  };
}

/** The shared assertions of a scale line: meter in tolerance, no underruns, counters zero. */
function expectWithinCapacity(m: Measured, countersZero: boolean): void {
  expect(m.renderCapacity, "CDP renderCapacity").not.toBeNull();
  expect(m.within, `meter ${String(m.meter)} vs renderCapacity ${String(m.renderCapacity)}`).toBe(true);
  if (m.meter !== null && m.meter < 1) expect(m.underruns ?? 0, "underrunEvents while the meter is below 1.0").toBe(0);
  if (countersZero) {
    const zero = counters(m.after.stats) ?? { missing: 1 };
    expect(Object.values(zero).every((value) => value === 0), JSON.stringify(zero)).toBe(true);
  }
}

for (const count of SCALE_TRACKS) {
  test(`scale: ${count} tracks, meter against renderCapacity`, async ({ page }) => {
    test.setTimeout(90_000);
    const m = await measure(page, `./?stress=${count}`);
    results[`tracks${count}`] = {
      tracks: count,
      renderCapacity: m.renderCapacity,
      meter: m.meter,
      difference: m.renderCapacity === null || m.meter === null ? null : (m.meter - m.renderCapacity) / m.renderCapacity,
      withinTolerance: m.within,
      underruns: m.underruns,
      counters: counters(m.after.stats),
      kickDriftSamples: kickDrift(m.after),
      sampleRate: m.after.sampleRate,
      calibration: m.calibration,
    };
    expectWithinCapacity(m, true);
    expect(kickDrift(m.after), "kick drift, samples").toBe(0);
  });
}

for (const instrument of ENGINE_REPRESENTATIVES) {
  test(`scale: 8 tracks of ${instrument}, meter against renderCapacity`, async ({ page }) => {
    test.setTimeout(90_000);
    const m = await measure(page, `./?stressEngine=${instrument}`);
    results[`engine-${instrument}`] = {
      instrument,
      renderCapacity: m.renderCapacity,
      meter: m.meter,
      difference: m.renderCapacity === null || m.meter === null ? null : (m.meter - m.renderCapacity) / m.renderCapacity,
      withinTolerance: m.within,
      underruns: m.underruns,
      counters: counters(m.after.stats),
      sampleRate: m.after.sampleRate,
    };
    expectWithinCapacity(m, true);
  });
}
