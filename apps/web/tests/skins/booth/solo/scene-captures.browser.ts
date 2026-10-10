// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The scene per instrument on the page and in the file, against the scene's quality bar.
// For each compared production, its drop looped:
//   - full-page captures at 1440 × 900 and 390 × 844 (.cache/screenshots/scene-<name>-*),
//     on the WebGL2 path;
//   - the light the stage received, replayed into the export's own stage: a story and a
//     16:9 frame with the brand mark drawn over them as the export draws it (centred in the
//     story, in the corner of the 16:9), saved next to the captures;
//   - measured on those file frames, 4 s at 30 fps: at least 35 % of the frame lit
//     (luminance above 0.08, the mark's veil left out), no dark seam at the chrome line
//     (no row within 0.1 u darker than half its neighbours);
//   - the brand zones' edge, on the 1440 stage and in both files: the same instant drawn
//     with the zones and without, so the figures cancel; the light the mask keeps changes
//     by at most 0.02 of luminance between neighbouring pixels within each zone + 0.2 u;
//   - the brand mark on every one of those file frames: the export's own
//     drawBrandMark with the Untzel lockup, composited over the light; its ink present in
//     the logo and the URL, the white letters at 4.5:1 or more and the lockup's orange accent
//     at 3:1 or more (a graphic, WCAG 1.4.11) against the brightest background under them.
// The numbers go to .cache/measurements/scene-captures.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { FrameStats } from "../../../../src/testing/frame-stats";
import { writeMeasurement } from "../support/measure-support";
import type { MarkContrast } from "../../../../src/testing/mark-contrast";
import { COMPARED, LOCKUP_URL, recordScene, runLab, stageBuffer } from "../support/scene-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../support/support";
const SCREENSHOTS = process.env["UNTZEL_SCREENSHOTS"] ?? join(process.cwd(), "../../.cache/screenshots");
const MIN_LIT = 0.35;
const MIN_SEAM = 0.5;
const MAX_ZONE_STEP = 0.02;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_ACCENT_CONTRAST = 3;
/**
 * At least half of the opaque ink the mark draws (measured 04/10/2026, the same in every
 * frame): the lockup at 466 × 72 is 0.101 white and 0.032 orange, the URL's box 0.152 white.
 */
const MIN_LOGO_WHITE = 0.05;
const MIN_LOGO_ACCENT = 0.016;
const MIN_URL_WHITE = 0.076;
const measured: Record<string, unknown> = {};
async function saveMarked(page: Page, still: string, name: string): Promise<void> {
  const marked = await page.evaluate(
    async ({ url, logo }) => (await (globalThis as unknown as { untzelTest: { sceneLab(): Promise<{ markedStill(still: string, logoUrl: string): Promise<string> }> } }).untzelTest.sceneLab()).markedStill(url, logo),
    { url: still, logo: LOCKUP_URL },
  );
  mkdirSync(SCREENSHOTS, { recursive: true });
  writeFileSync(join(SCREENSHOTS, `${name}.png`), Buffer.from(marked.split(",")[1] ?? "", "base64"));
}
function maskEdge(page: Page, width: number, height: number, surface: "screen" | "file", t: number): Promise<number> {
  return page.evaluate(
    async (run) => (await (globalThis as unknown as { untzelTest: { sceneLab(): Promise<{ maskEdgeStep(width: number, height: number, surface: string, t: number): number }> } }).untzelTest.sceneLab()).maskEdgeStep(run.width, run.height, run.surface, run.t),
    { width, height, surface, t },
  );
}
/** The worst frame of the mark: the lowest contrast and the least ink over the run. */
function markSummary(marks: readonly MarkContrast[]) {
  const least = (pick: (mark: MarkContrast) => number) => Math.min(...marks.map(pick));
  return {
    frames: marks.length,
    textContrast: least((mark) => mark.textContrast),
    accentContrast: least((mark) => mark.accentContrast),
    backgroundMaxY: Math.max(...marks.map((mark) => mark.backgroundMaxY)),
    logoWhiteShare: least((mark) => mark.logoWhiteShare),
    logoAccentShare: least((mark) => mark.logoAccentShare),
    urlWhiteShare: least((mark) => mark.urlWhiteShare),
  };
}
/**
 * What these limits prove: with the elliptical brand zone the scene leaves the
 * background under the mark black, so the numbers are the same in every template and format
 * (backgroundMaxY 0.004 is the mark's own glow). The contrast checks guard that zone, not
 * legibility over partial light, which does not happen while the zone holds. If the zone is
 * ever loosened, backgroundMaxY rises and the contrast drops here first: do not relax these
 * limits to make such a change pass.
 */
function expectMark(format: string, mark: ReturnType<typeof markSummary>, frames: number): void {
  expect(mark.frames, `${format}: the mark measured on every frame`).toBe(frames);
  expect(mark.logoWhiteShare, `${format}: the lockup's white ink`).toBeGreaterThanOrEqual(MIN_LOGO_WHITE);
  expect(mark.logoAccentShare, `${format}: the lockup's orange ink`).toBeGreaterThanOrEqual(MIN_LOGO_ACCENT);
  expect(mark.urlWhiteShare, `${format}: the URL's ink`).toBeGreaterThanOrEqual(MIN_URL_WHITE);
  expect(mark.textContrast, `${format}: the mark's letters against the light`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  expect(mark.accentContrast, `${format}: the lockup's accent against the light`).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
}
function summary(frames: readonly FrameStats[]) {
  return {
    lit: Math.min(...frames.map((frame) => frame.lit)),
    litBelow: Math.min(...frames.map((frame) => frame.litBelow)),
    seam: Math.min(...frames.map((frame) => frame.seamRatio)),
  };
}
test.describe.configure({ mode: "serial" });
test.afterAll(() => writeMeasurement("scene-captures", measured));
for (const production of COMPARED) {
  test(`${production.name}: the scene on the page and in the file, lit, seamless, with the mark in place`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[1440]);
    const programAt = await recordScene(page, { template: production.template }, 10);
    expect(await page.evaluate(() => document.documentElement.dataset["renderer"])).toBe("webgl2");
    await screenshot(page, `scene-${production.name}`, 1440);
    await page.setViewportSize(VIEWPORTS[390]);
    await page.waitForTimeout(1_000);
    await screenshot(page, `scene-${production.name}`, 390);
    await page.setViewportSize(VIEWPORTS[1440]);
    const results: Record<string, unknown> = {};
    for (const [format, width, height] of [["story", 1080, 1920], ["video", 1920, 1080]] as const) {
      const run = await runLab(page, { width, height, surface: "file", reducedMotion: false, from: programAt + 3, seconds: 4, fps: 30, measure: true, stills: [2], markLogoUrl: LOCKUP_URL });
      const still = run.stills[0];
      if (still === undefined) throw new Error("no still");
      await saveMarked(page, still, `scene-${production.name}-${format}-file`);
      const numbers = summary(run.frames);
      expect(run.kind).toBe("webgl2");
      expect(numbers.lit, `${format}: lit share in the drop`).toBeGreaterThanOrEqual(MIN_LIT);
      expect(numbers.seam, `${format}: the chrome line's darkest row over its neighbours`).toBeGreaterThanOrEqual(MIN_SEAM);
      const mark = markSummary(run.marks);
      expectMark(format, mark, run.frames.length);
      const edge = await maskEdge(page, width, height, "file", programAt + 5);
      results[format] = { ...numbers, maskEdgeStep: edge, mark };
      expect(edge, `${format}: the brand zones' edge step`).toBeLessThanOrEqual(MAX_ZONE_STEP);
    }
    const stage = await stageBuffer(page);
    const stageEdge = await maskEdge(page, stage.width, stage.height, "screen", programAt + 5);
    results["stage-1440"] = { maskEdgeStep: stageEdge };
    expect(stageEdge, "the 1440 stage: the brand zones' edge step").toBeLessThanOrEqual(MAX_ZONE_STEP);
    measured[production.name] = results;
    expect(errors).toEqual([]);
  });
}
