// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The responsive stage on the real session: at 390×844, 768×1024, 1024×768
// and 1440×900 the canvas buffer follows the stage at the device pixel ratio, capped at 2
// (a 3× screen draws at 2×), and a resize or a rotation refits it. The scene's own fit
// (shorter side, safe area) is fitScene's, unit tested in packages/light; these captures
// are for a look at the composition: .cache/screenshots/stage-fit-<width>.png (the page)
// and stage-canvas-<width>.png (the canvas alone).
import { expect, test, type Page } from "@playwright/test";
import { startEngine } from "../../support/share-support";
import { VIEWPORTS, collectErrors, elementScreenshot, screenshot, type ViewportWidth } from "../../../../support/support";

const MAX_DEVICE_PIXEL_RATIO = 2;
const BAR_MS = (240 / 132) * 1_000;

interface CanvasSize {
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly width: number;
  readonly height: number;
  readonly ratio: number;
}

function canvasSize(page: Page): Promise<CanvasSize> {
  return page.locator("canvas.untzel-stage").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return { clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight, width: canvas.width, height: canvas.height, ratio: window.devicePixelRatio };
  });
}

/** The buffer is the stage at the capped ratio, or below it when the frame budget lowered it; never above, never stretched. */
function expectBuffer(size: CanvasSize, what: string): void {
  const ratio = Math.min(size.ratio, MAX_DEVICE_PIXEL_RATIO);
  expect(size.clientWidth, `${what}: the stage has a size`).toBeGreaterThan(0);
  expect(size.width, `${what}: buffer width`).toBeLessThanOrEqual(Math.round(size.clientWidth * ratio));
  expect(size.height, `${what}: buffer height`).toBeLessThanOrEqual(Math.round(size.clientHeight * ratio));
  expect(size.width, `${what}: buffer width`).toBeGreaterThanOrEqual(Math.round(size.clientWidth * ratio * 0.5));
  expect(Math.abs(size.width / size.clientWidth - size.height / size.clientHeight), `${what}: same scale both ways`).toBeLessThanOrEqual(0.02);
}

async function waitRefit(page: Page): Promise<CanvasSize> {
  await expect
    .poll(async () => {
      const size = await canvasSize(page);
      return Math.abs(size.width / Math.min(size.ratio, MAX_DEVICE_PIXEL_RATIO) - size.clientWidth) <= size.clientWidth * 0.5;
    })
    .toBe(true);
  return canvasSize(page);
}

for (const width of [390, 768, 1024, 1440] as const satisfies readonly ViewportWidth[]) {
  test(`the stage at ${VIEWPORTS[width].width}×${VIEWPORTS[width].height} follows its size at the capped pixel ratio`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page);
    await page.waitForTimeout(2 * BAR_MS);
    expectBuffer(await waitRefit(page), `${width}`);
    await screenshot(page, "stage-fit", width);
    await elementScreenshot(page.locator("canvas.untzel-stage"), "stage-canvas", width);
    expect(errors).toEqual([]);
  });
}

test.describe("on a 3× screen", () => {
  test.use({ deviceScaleFactor: 3 });
  test("the buffer is drawn at 2×, and a rotation refits it", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startEngine(page);
    const portrait = await waitRefit(page);
    expect(portrait.ratio).toBe(3);
    expectBuffer(portrait, "portrait");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await canvasSize(page)).clientWidth).not.toBe(portrait.clientWidth);
    const landscape = await waitRefit(page);
    expectBuffer(landscape, "landscape");
    expect(landscape.width).not.toBe(portrait.width);
    expect(errors).toEqual([]);
  });
});
