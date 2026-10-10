// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// "Two exports of the same text have equal frames", a check of the export's quality bar.
// Two halves:
//   - the scene: the same recorded light replayed twice into the export's own stage, story
//     and 16:9, with the trail and the bloom, gives bit-identical frames;
//   - the file: the same text, the music stopped (so both plans start at bar 0), rendered
//     twice through the real Export sheet. The H.264 encoder does not promise the same
//     bytes twice, so the decoded frames are held to the encoder's noise: at most 1/255 of
//     mean difference per frame (measured: 0.21/255 on the mean).
import { expect, test, type Page } from "@playwright/test";
import type { VideoComparison } from "../../../../src/testing/scene-lab";
import { openExport, renderExport } from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { COMPARED, recordScene, runLab } from "../support/scene-support";
import { stopMusic, tapToPlay } from "../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";
const MAX_FRAME_MEAN = 1;
/** Renders a story of the stopped text and keeps the file in the page under `key`. */
async function renderStory(page: Page, key: string): Promise<void> {
  await openExport(page);
  await renderExport(page, 120_000);
  await page.evaluate((name) => {
    const hooks = (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest;
    (globalThis as unknown as Record<string, unknown>)[name] = hooks.exportFile();
  }, key);
  await page.keyboard.press("Escape");
}
test("the same recorded light, replayed twice, gives bit-identical story and 16:9 frames", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  const programAt = await recordScene(page, { template: COMPARED[0].template }, 8);
  for (const [width, height] of [[1080, 1920], [1920, 1080]] as const) {
    const run = { width, height, surface: "file" as const, reducedMotion: false, from: programAt + 2, seconds: 3, fps: 30, measure: true };
    const first = await runLab(page, run);
    const second = await runLab(page, run);
    expect(first.kind).toBe("webgl2");
    expect(first.hashes).toHaveLength(90);
    expect(second.hashes, `${width} × ${height}`).toEqual(first.hashes);
    // Not a blank frame repeated: the frames move.
    expect(new Set(first.hashes).size).toBeGreaterThan(60);
  }
  expect(errors).toEqual([]);
});
test("two stories of the same text, rendered by the Export sheet, decode to the same frames", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto(`./?template=${COMPARED[1].template}`);
  await tapToPlay(page);
  await stopMusic(page);
  await renderStory(page, "storyA");
  await page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }).waitFor();
  await renderStory(page, "storyB");
  const comparison = await page.evaluate(async () => {
    const scope = globalThis as unknown as Record<string, Blob> & { untzelTest: { sceneLab(): Promise<{ compareVideos(a: Blob, b: Blob): Promise<VideoComparison> }> } };
    return (await scope.untzelTest.sceneLab()).compareVideos(scope["storyA"] as Blob, scope["storyB"] as Blob);
  });
  writeMeasurement("export-frames", comparison);
  expect(comparison.framesA).toBeGreaterThan(300);
  expect(comparison.framesB).toBe(comparison.framesA);
  expect(comparison.worstFrameMean).toBeLessThanOrEqual(MAX_FRAME_MEAN);
  expect(errors).toEqual([]);
});
