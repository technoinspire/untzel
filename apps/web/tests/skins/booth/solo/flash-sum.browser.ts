// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The flash limiter measured on the final pixels: it applies to the final composited
// output, after bloom and feedback. Each production plays live with its drop looped; the
// light the stage receives
// is replayed into the export's own stage (WebGL2, trail and bloom) and every frame is read
// back after the last pass, before any brand mark. 6 s at 60 fps, in normal and reduced
// motion, on the 1440 stage, the 390 stage and the story frame:
//   - at most 3 flashes in any second, over the whole frame and in each of nine quarter
//     windows (WCAG general flash: opposing changes of 0.10, flash-count.ts);
//   - white (R, G, B ≥ 0.95) on at most 0.2 % of the frame: the white cores of the hat,
//     the ride and the bell are white by design and stay that small;
//   - on the page, the band under the top bar averages at most 1/255 above the stage;
//   - in the story, no light at all under the brand mark's veil.
// The 64-track production is the library song with its first tracks doubled. Numbers go
// to .cache/measurements/flash-sum.json.
import { expect, test, type Page } from "@playwright/test";
import { worstFlashesPerSecond } from "../../../../src/testing/flash-count";
import type { FrameStats } from "../../../../src/testing/frame-stats";
import { writeMeasurement } from "../support/measure-support";
import { COMPARED, recordScene, runLab, stageBuffer, stressSixtyFour } from "../support/scene-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";
const FPS = 60;
const SECONDS = 6;
const MAX_FLASHES = 3;
const MAX_WHITE_SHARE = 0.002;
const MAX_BAND_MEAN = 1;
interface Surface {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly surface: "screen" | "file";
}
interface Outcome {
  readonly surface: string;
  readonly reducedMotion: boolean;
  readonly renderer: string;
  readonly flashes: number;
  readonly worstWindowFlashes: number;
  readonly whiteShare: number;
  readonly bandMean: number;
  readonly veilMax: number;
}
const measured: Record<string, Outcome[]> = {};
async function surfaces(page: Page): Promise<readonly Surface[]> {
  const desk = await stageBuffer(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await expect.poll(async () => (await stageBuffer(page)).width).toBeLessThan(desk.width);
  const phone = await stageBuffer(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  return [
    { key: "stage-1440", ...desk, surface: "screen" },
    { key: "stage-390", ...phone, surface: "screen" },
    { key: "story", width: 1080, height: 1920, surface: "file" },
  ];
}
function outcomeOf(surface: Surface, reducedMotion: boolean, renderer: string, frames: readonly FrameStats[]): Outcome {
  const windows = Array.from({ length: 9 }, (_, index) => worstFlashesPerSecond(frames.map((frame) => frame.windows[index] ?? 0), FPS));
  return {
    surface: surface.key,
    reducedMotion,
    renderer,
    flashes: worstFlashesPerSecond(frames.map((frame) => frame.mean), FPS),
    worstWindowFlashes: Math.max(...windows),
    whiteShare: Math.max(...frames.map((frame) => frame.whiteShare)),
    bandMean: Math.max(...frames.map((frame) => frame.bandMean)),
    veilMax: Math.max(...frames.map((frame) => frame.veilMax)),
  };
}
const PRODUCTIONS = [...COMPARED.map(({ name, template }) => ({ name, start: { template } })), { name: "stress-64", start: { source: stressSixtyFour() } }];
test.describe.configure({ mode: "serial" });
test.afterAll(() => writeMeasurement("flash-sum", measured));
for (const production of PRODUCTIONS) {
  test(`${production.name}: at most 3 flashes a second on the final pixels, no white flood, dark chrome band and veil`, async ({ page }) => {
    test.setTimeout(420_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[1440]);
    const programAt = await recordScene(page, production.start);
    const outcomes: Outcome[] = [];
    for (const surface of await surfaces(page)) {
      for (const reducedMotion of [false, true]) {
        const result = await runLab(page, { width: surface.width, height: surface.height, surface: surface.surface, reducedMotion, from: programAt + 3, seconds: SECONDS, fps: FPS, measure: true });
        outcomes.push(outcomeOf(surface, reducedMotion, result.kind, result.frames));
      }
    }
    measured[production.name] = outcomes;
    for (const outcome of outcomes) {
      const what = `${outcome.surface}${outcome.reducedMotion ? " reduced" : ""}`;
      expect(outcome.renderer, `${what}: the WebGL2 path`).toBe("webgl2");
      expect(outcome.flashes, `${what}: flashes a second, whole frame`).toBeLessThanOrEqual(MAX_FLASHES);
      expect(outcome.worstWindowFlashes, `${what}: flashes a second, worst quarter window`).toBeLessThanOrEqual(MAX_FLASHES);
      expect(outcome.whiteShare, `${what}: white share`).toBeLessThanOrEqual(MAX_WHITE_SHARE);
      if (outcome.surface === "story") expect(outcome.veilMax, `${what}: light under the veil`).toBe(0);
      else expect(outcome.bandMean, `${what}: the chrome band over the stage, x/255`).toBeLessThanOrEqual(MAX_BAND_MEAN);
    }
    expect(errors).toEqual([]);
  });
}
