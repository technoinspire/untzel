// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song's title in the exported video, on the real engine: a long
// title renamed in the bar goes into a story and a 16:9 video as the title card of the
// first 1.5 s and the caption after it, measured on every decoded frame against negative
// controls, with the brand mark still on every light frame, neither title reaching the
// mark's scrim, the 16:9 caption off the rings, and the title in the file's name and tag.
import { expect, test, type Page } from "@playwright/test";
import { expectMark, expectTitle, inspectMp4, openExport, renderExport, saveExport, seedDeviceProbe } from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { startEngine } from "../support/share-support";
import { VIEWPORTS, collectErrors, expectAttribution } from "../../../support/support";

const LONG_TITLE = "Remix of Midnight Coast at the Harbour";

async function rename(page: Page, title: string): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 });
  await heading.getByRole("button").click();
  await page.getByRole("textbox", { name: "Song title" }).fill(title);
  await page.keyboard.press("Enter");
  await expect(heading).toHaveText(title);
}

function exportName(page: Page): Promise<string> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest.exportFile()?.name ?? "");
}

for (const [format, width, file] of [
  ["Story", 390, "title-story.mp4"],
  ["Video", 1440, "title-video.mp4"],
] as const) {
  test(`a ${format} carries the song's title card, then its caption, with the mark on every frame`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page);
    await seedDeviceProbe(page, false);
    await rename(page, LONG_TITLE);
    const sheet = await openExport(page);
    await sheet.getByRole("button", { name: new RegExp(`^${format}`) }).click();
    await renderExport(page);
    await expectAttribution(page);
    await saveExport(page, file);
    expect(await exportName(page)).toMatch(/^remix-of-midnight-coast-at-the-harbour-.*\.mp4$/);
    const report = await inspectMp4(page, true);
    writeMeasurement(`export-test-title-${format.toLowerCase()}`, {
      width: report.width,
      height: report.height,
      songTitle: report.songTitle,
      markScrim: report.markScrim,
      worstMarkContrast: report.worstMarkContrast,
      title: report.title,
    });
    expectMark(report);
    expectTitle(report, LONG_TITLE);
    expect((await page.evaluate(() => (globalThis as unknown as { untzelTest: { session(): { playing: boolean } } }).untzelTest.session().playing))).toBe(true);
    expect(errors).toEqual([]);
  });
}
