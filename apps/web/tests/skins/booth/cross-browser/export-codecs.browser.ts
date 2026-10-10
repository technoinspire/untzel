// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// `pnpm test:browser --engines`: what each engine ends up with under the codec rule of
// the export (H.264 always, never VP9). Firefox: H.264 + Opus in MP4 (no AAC there),
// with "Opus audio" in the Ready line. Playwright's WebKit announces H.264
// and never delivers a chunk: every attempt misses its deadline, so the sheet asks to try
// again and no MP4 is made. Playwright's WebKit is not Safari; the iPhone is measured on
// the device.
import { expect, test } from "@playwright/test";
import { writeMeasurement } from "../support/measure-support";
import { openExport, renderExport } from "../support/export-support";
import { LOGO_URL, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS } from "../../../support/support";

test("Firefox: the story is H.264 with Opus, says so, and opens", async ({ page }, info) => {
  test.skip(info.project.name !== "firefox", "Firefox only");
  // Software encoders in these engines: measured 8 to 31 s for the story, then the read-back.
  test.setTimeout(240_000);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await stopMusic(page);
  const sheet = await openExport(page);
  await renderExport(page, 180_000);
  await expect(sheet.locator(".ui-export__status")).toHaveText(/· MP4 · Opus audio · /);
  const result = await page.evaluate(async (logo) => {
    const hooks = (globalThis as unknown as {
      untzelTest: {
        exportFile(): File | null;
        exportDetails(): { codecs: string; renderMs: number } | null;
        exportLab(): Promise<{ inspectMp4(file: Blob, logo: string): Promise<{ videoFrames: number; width: number; height: number }> }>;
      };
    }).untzelTest;
    const file = hooks.exportFile();
    if (file === null) throw new Error("no export");
    const report = await (await hooks.exportLab()).inspectMp4(file, logo);
    return { details: hooks.exportDetails(), frames: report.videoFrames, width: report.width, height: report.height, size: file.size };
  }, LOGO_URL);
  writeMeasurement("export-codecs-firefox", result);
  const [video, audio] = (result.details?.codecs ?? "").split(", ");
  expect(video).toMatch(/^avc1\./);
  expect(audio).toBe("opus");
  expect(result).toMatchObject({ width: 1080, height: 1920 });
});

test("Playwright's WebKit: H.264 never answers, so no MP4 is made and Render can be tried again", async ({ page }, info) => {
  test.skip(info.project.name !== "webkit", "WebKit only");
  // Four probe attempts (3 + 6 + 6 + 6 s) and their backoffs (0.5 + 1 + 2 s).
  test.setTimeout(120_000);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await stopMusic(page);
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: "Render", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("The video encoder didn't answer in time. Try Render again.", { timeout: 90_000 });
  await expect(sheet.getByRole("button", { name: "Download" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Try again" })).toBeVisible();
});
