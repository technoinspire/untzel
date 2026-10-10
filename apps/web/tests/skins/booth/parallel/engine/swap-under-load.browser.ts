// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A structural text change
// followed by an 80 ms busy loop on the main thread. Passes with lateDrops = skippedBars
// = 0 and the new pattern starting on the computed bar boundary: a "probe" track with a
// hit on every beat, added by the change, whose onsets sit exactly on
// startFrame + floor(beat × 60 × sr / 132) and whose first beat opens a bar.

import { expect, test } from "@playwright/test";
import { ONBOARD_BPM, beatFrame, counters, measurementSuite, read, tapAndWait, writeMeasurement } from "../../support/measure-support";

measurementSuite();

const BUSY_MS = 80;
const BAR_MS = (240 / ONBOARD_BPM) * 1000;

interface SwapHooks {
  applyText(text: string): void;
  session(): { source: string; position: { bar: number } | null };
}

test("a structural change under an 80 ms main-thread stall lands on the next bar", async ({ page }) => {
  // On the phase 1 onboard, whose tempo ONBOARD_BPM is.
  await page.goto("./?template=phase1-onboard");
  await tapAndWait(page);
  await page.waitForTimeout(2 * BAR_MS);
  const appliedAtBar = await page.evaluate((busyMs) => {
    const t = (globalThis as unknown as { untzelTest: SwapHooks }).untzelTest;
    const bar = t.session().position?.bar ?? null;
    // Tracks come before sections: the probe goes right above the first one.
    const source = t.session().source;
    const at = source.indexOf("\nsection ");
    t.applyText(`${source.slice(0, at)}\nprobe: hat x... x... x... x...${source.slice(at)}`);
    const end = performance.now() + busyMs;
    while (performance.now() < end) {
      // Busy: the main thread does nothing else for 80 ms.
    }
    return bar;
  }, BUSY_MS);
  await page.waitForTimeout(4 * BAR_MS);
  const reading = await read(page);
  const probe = reading.stats?.instances.find((instance) => instance.name === "probe");
  const startFrame = reading.startFrame ?? 0;
  // The beat of the probe's last onset, then the beat its first onset fell on.
  const lastBeat = probe === undefined ? -1 : Math.round(((probe.lastOnsetFrame - startFrame) * ONBOARD_BPM) / (60 * reading.sampleRate));
  const firstBeat = probe === undefined ? -1 : lastBeat - (probe.onsetCount - 1);
  const boundaryBar = firstBeat / 4;
  writeMeasurement("swap-under-load", {
    busyMs: BUSY_MS,
    appliedAtBar,
    boundaryBar,
    probeOnsets: probe?.onsetCount ?? 0,
    lastOnsetFrame: probe?.lastOnsetFrame ?? null,
    expectedLastOnsetFrame: probe === undefined ? null : beatFrame(startFrame, lastBeat, reading.sampleRate),
    counters: counters(reading.stats),
  });
  expect(probe, "the probe track sounds").toBeDefined();
  expect(probe?.lastOnsetFrame).toBe(beatFrame(startFrame, lastBeat, reading.sampleRate));
  expect(Number.isInteger(boundaryBar), `first probe beat ${firstBeat} opens a bar`).toBe(true);
  // The next unscheduled boundary: one or two bars after the bar that was sounding.
  expect(boundaryBar).toBeGreaterThan(appliedAtBar ?? Number.POSITIVE_INFINITY);
  expect(boundaryBar).toBeLessThanOrEqual((appliedAtBar ?? 0) + 2);
  expect(reading.stats?.lateDrops).toBe(0);
  expect(reading.stats?.skippedBars).toBe(0);
  expect(counters(reading.stats)).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0, unknownTargets: 0, unknownMessages: 0, skippedBars: 0, resyncs: 0 });
});
