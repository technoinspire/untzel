// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// `pnpm test:browser --measure`: the scene's frame work with 64 tracks. The rAF interval
// is held to the display's refresh, so it cannot show
// how much of a frame the scene uses; this measures the work itself. The 64-track text
// plays live, its light is recorded and replayed into the stage's own pipeline (WebGL2,
// trail and bloom) at the live stage's buffer size, and each frame is timed from the draw
// to a 1-pixel read-back, which waits for the GPU: CPU and GPU together.
//   1440 × 900 at DPR 2: p95 ≤ 14 ms. 390 × 844 at DPR 3 (the buffer capped at 2) under
//   CPU × 4: p95 ≤ 16.7 ms. The numbers go to .cache/measurements/stress-64-<case>.json.
// The "page" cases measure the whole page instead: stress-64-page-<case>.json.
import { expect, test } from "@playwright/test";
import { measurePageFrames } from "../../support/frame-support";
import { measurementSuite, tapAndWait, writeMeasurement } from "../../support/measure-support";
import { recordScene, runLab, stageBuffer, stressSixtyFour } from "../../support/scene-support";
import { stopMusic } from "../../support/share-support";
import { collectErrors } from "../../../../support/support";
measurementSuite("independent");
const CASES = [
  { name: "1440-dpr2", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, cpu: 1, p95: 14 },
  { name: "390-dpr3-cpu4", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, cpu: 4, p95: 16.7 },
] as const;
const percentile = (sorted: readonly number[], share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? Number.NaN;
// The page itself with 64 tracks playing, the stage live, at ≥ 50 fps,
// and at most one view update per frame (the slack is the ResizeObserver's count label).
const PAGE_CASES = [
  { name: "390-dpr3-cpu4", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, cpu: 4, rows: ".ui-grid .ui-tile:not(.ui-tile--add)" },
  { name: "1440-dpr2", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, cpu: 1, rows: ".ui-table__body .ui-table__row" },
] as const;
const PAGE_FPS = 50;
const PAGE_SECONDS = 10;
/** Frames where the count label's ResizeObserver wrote after the view's update. */
const PAGE_SLACK_FRAMES = 2;
test.describe("page", () => {
  for (const entry of PAGE_CASES) {
    test.describe(entry.name, () => {
      test.use({ viewport: entry.viewport, deviceScaleFactor: entry.deviceScaleFactor });
      test(`64 tracks: the page at ≥ ${PAGE_FPS} fps, one view update per frame`, async ({ page, context }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await page.goto("./?stress=64");
        await tapAndWait(page);
        await expect(page.locator(entry.rows)).toHaveCount(64, { timeout: 30_000 });
        await page.waitForTimeout(2_000);
        const cdp = await context.newCDPSession(page);
        if (entry.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: entry.cpu });
        const frames = await measurePageFrames(page, PAGE_SECONDS);
        if (entry.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        writeMeasurement(`stress-64-page-${entry.name}`, { case: entry.name, ...frames });
        expect(frames.fps).toBeGreaterThanOrEqual(PAGE_FPS);
        expect(frames.framesWithSeveralBatches, "one view update per frame").toBeLessThanOrEqual(PAGE_SLACK_FRAMES);
        if (entry.name === "1440-dpr2") await expect(page.locator(".ui-table__count")).not.toHaveText("");
        expect(errors).toEqual([]);
      });
    });
  }
});
for (const entry of CASES) {
  test.describe(entry.name, () => {
    test.use({ viewport: entry.viewport, deviceScaleFactor: entry.deviceScaleFactor });
    test(`64 tracks: the scene's frame work at p95 ≤ ${entry.p95} ms`, async ({ page, context }) => {
      test.setTimeout(240_000);
      const errors = collectErrors(page);
      const programAt = await recordScene(page, { source: stressSixtyFour() }, 10);
      const size = await stageBuffer(page);
      await stopMusic(page);
      const cdp = await context.newCDPSession(page);
      if (entry.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: entry.cpu });
      const result = await runLab(page, { ...size, surface: "screen", reducedMotion: false, from: programAt + 2, seconds: 6, fps: 60 });
      if (entry.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      // The first frames build the targets and roll the trail's pre-roll.
      const sorted = result.workMs.slice(10).sort((a, b) => a - b);
      const reading = { case: entry.name, buffer: size, renderer: result.kind, frames: sorted.length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99) };
      writeMeasurement(`stress-64-${entry.name}`, reading);
      expect(result.kind).toBe("webgl2");
      expect(reading.p95).toBeLessThanOrEqual(entry.p95);
      expect(errors).toEqual([]);
    });
  });
}
