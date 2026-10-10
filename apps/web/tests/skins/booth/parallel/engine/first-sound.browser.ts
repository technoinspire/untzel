// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Tap to first kick with CPU ×4 and Slow 4G,
// clicked as soon as the page loads. Estimate, not the speaker:
//   (tRunning − tClick) + 1000 × startFrame / sr + 1000 × outputLatency
// The kick plays on the start frame, so the start frame is its first onset.
// The report adds where the time went: the navigation-to-tap time, the
// `untzel:*` phase marks and every download, relative to the tap. The HTML's engine
// preloads must be used: one WASM download, no preload warning from Chrome.
import { expect, test } from "@playwright/test";
import { counters, measurementSuite, read, tapAndWait, throttle, writeMeasurement } from "../../support/measure-support";
measurementSuite();
const FIRST_SOUND_LIMIT_MS = 1000;
/** Chrome warns about an unused preload 3 s after the load event. */
const PRELOAD_WARNING_WAIT_MS = 3500;
const results: Record<string, unknown> = {};
// --repeat-each runs each repeat in its own worker: one file per repeat.
test.afterAll(({}, info) => writeMeasurement(info.repeatEachIndex === 0 ? "first-sound" : `first-sound-${info.repeatEachIndex}`, results));
for (const throttled of [false, true]) {
  test(`tap to first kick${throttled ? " (CPU ×4, Slow 4G)" : ""}`, async ({ page }) => {
    const preloadWarnings: string[] = [];
    page.on("console", (message) => {
      if (/preload/i.test(message.text())) preloadWarnings.push(message.text());
    });
    if (throttled) await throttle(page);
    await page.goto("./");
    await tapAndWait(page, true);
    const reading = await read(page);
    const tap = reading.tappedAt ?? 0;
    const running = reading.runningAt ?? tap;
    const startFrame = reading.startFrame ?? 0;
    const latencyMs = running - tap + (1000 * startFrame) / reading.sampleRate + 1000 * reading.outputLatency;
    // Reported, not asserted: the start frame on the output clock (getOutputTimestamp), which
    // also counts the time between "running" and the context's clock really advancing.
    const outputClockMs = await page.evaluate((frame) => {
      const hooks = (globalThis as unknown as { untzelTest: { outputTimestamp(): AudioTimestamp; sampleRate(): number } }).untzelTest;
      const stamp = hooks.outputTimestamp();
      return (stamp.performanceTime ?? 0) + (frame / hooks.sampleRate() - (stamp.contextTime ?? 0)) * 1000;
    }, startFrame);
    await page.waitForTimeout(PRELOAD_WARNING_WAIT_MS);
    // Where the time went: every download and every startup mark, relative to the tap.
    const timeline = await page.evaluate((tapped) => ({
      resources: performance.getEntriesByType("resource").map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          name: resource.name.split("/").pop(),
          startMs: Math.round(resource.startTime - tapped),
          endMs: Math.round(resource.responseEnd - tapped),
          bytes: resource.transferSize,
        };
      }),
      marks: Object.fromEntries(
        performance
          .getEntriesByType("mark")
          .filter((mark) => mark.name.startsWith("untzel:"))
          .map((mark) => [mark.name.slice("untzel:".length), Math.round(mark.startTime - tapped)]),
      ),
    }), tap);
    results[throttled ? "throttled" : "unthrottled"] = {
      latencyMs: Math.round(latencyMs),
      outputClockMs: Math.round(outputClockMs - tap),
      navigationToTapMs: Math.round(tap),
      tapToRunningMs: Math.round(running - tap),
      runningToStartMs: Math.round((1000 * startFrame) / reading.sampleRate),
      startFrame,
      sampleRate: reading.sampleRate,
      outputLatencyMs: Math.round(reading.outputLatency * 1000),
      counters: counters(reading.stats),
      marks: timeline.marks,
      resources: timeline.resources,
    };
    expect(startFrame % 128).toBe(0);
    expect(Object.values(counters(reading.stats) ?? { missing: 1 }).every((value) => value === 0), JSON.stringify(counters(reading.stats))).toBe(true);
    expect(timeline.resources.filter((resource) => resource.name?.startsWith("untzel_dsp-")), "one WASM download").toHaveLength(1);
    expect(preloadWarnings).toEqual([]);
    expect(latencyMs, "tap to first kick, ms").toBeLessThan(FIRST_SOUND_LIMIT_MS);
  });
}
