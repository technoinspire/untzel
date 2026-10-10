// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Flow J on the real engine: the story and a one-part video render in the export worker
// once Render is tapped, are read back with Mediabunny in the page, and must
// carry the brand mark on every light frame (sampled at 10, 50 and 90 % against a control
// off the mark) and the closing card on every frame of its last 2 s (logo, URL and "Made
// with Untzel", per rectangle, against negative controls), with the sound aligned to the
// WAV of the same plan. The device probe is seeded (HD only) so these tests time the
// render, not the probe; export-render.browser.ts covers the probe and the render-only flow.
import { expect, test, type Page } from "@playwright/test";
import {
  CARD_CONTROL,
  details,
  expectAudioCoversVideo,
  expectCard,
  expectMark,
  freshBrowserPage,
  inspectMp4,
  inspectWav,
  openExport,
  renderExport,
  saveExport,
  seedDeviceProbe,
  totalFrames,
} from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { LOGO_URL, PHASE1_ONBOARD_PATH, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../support/support";

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
interface CanvasCheck {
  readonly fontReady: boolean;
  readonly logoVsNoLogo: number;
  readonly urlVsNoUrl: number;
  readonly url: { readonly box: Box; readonly rect: Box };
  readonly markUrl: { readonly box: Box; readonly rect: Box };
}
interface PreviewGeometry {
  readonly size: { readonly width: number; readonly height: number };
  readonly rects: Readonly<Record<"markLogo" | "scrim" | "cardLogo", Box>>;
  readonly markUrlCenter: number;
}

/** Sound and light within 48 samples (1 ms). */
const ALIGNMENT_SECONDS = 48 / 48_000;
/**
 * Story at HD, Chrome on the reference Mac, no throttling: 5 s once the encoder has
 * started, 7 s for the first video render of a browser
 * session, which pays the H.264 encoder's ~2 s start in quantizer mode. Same quality in both.
 */
const STORY_LIMIT_MS = 5_000;
const FIRST_STORY_LIMIT_MS = 7_000;

function expectInside(fit: { readonly box: Box; readonly rect: Box }, what: string): void {
  expect(fit.box.x, what).toBeGreaterThanOrEqual(fit.rect.x);
  expect(fit.box.y, what).toBeGreaterThanOrEqual(fit.rect.y);
  expect(fit.box.x + fit.box.w, what).toBeLessThanOrEqual(fit.rect.x + fit.rect.w);
  expect(fit.box.y + fit.box.h, what).toBeLessThanOrEqual(fit.rect.y + fit.rect.h);
}

test("the closing card and the mark on canvas: the controls differ per rectangle and the text fits its boxes", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  const result = await page.evaluate(async (logo) => {
    const hooks = (globalThis as unknown as { untzelTest: { exportLab(): Promise<{ checkCardCanvas(logo: string): Promise<CanvasCheck> }> } }).untzelTest;
    return (await hooks.exportLab()).checkCardCanvas(logo);
  }, LOGO_URL);
  expect(result.fontReady).toBe(true);
  expect(result.logoVsNoLogo).toBeGreaterThanOrEqual(CARD_CONTROL);
  expect(result.urlVsNoUrl).toBeGreaterThanOrEqual(CARD_CONTROL);
  expectInside(result.url, "the card's URL");
  expectInside(result.markUrl, "the mark's URL");
  writeMeasurement("export-test-card", result);
});

test("the 16:9 mark on canvas: no pixel of its glow inside the rings' disc, HD and 4K", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  for (const quality of ["hd", "4k"] as const) {
    const counted = await page.evaluate(
      async ([logo, chosen]) => {
        const hooks = (globalThis as unknown as { untzelTest: { exportLab(): Promise<{ cornerGlowInRings(logo: string, quality: string): Promise<{ cut: number; uncut: number }> }> } }).untzelTest;
        return (await hooks.exportLab()).cornerGlowInRings(logo, chosen);
      },
      [LOGO_URL, quality] as const,
    );
    writeMeasurement(`export-test-glow-rings-${quality}`, counted);
    // Nothing of the mark or its glow inside the disc.
    expect(counted.cut, `${quality}: glow pixels inside the rings' disc`).toBe(0);
    // Positive control: the same glow without its cut does reach into the disc.
    expect(counted.uncut, `${quality}: the uncut glow inside the disc`).toBeGreaterThan(0);
  }
});

test("the sheet's preview places the mark and the card where the file has them, story and 16:9", async ({ page }) => {
  for (const [width, format] of [[390, "story"], [1440, "story"], [1440, "video"]] as const) {
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page, PHASE1_ONBOARD_PATH);
    const sheet = await openExport(page);
    if (format === "video") await sheet.getByRole("button", { name: /^Video/ }).click();
    await expect(sheet.locator(".ui-preview__mark-logo")).toBeVisible();
    await expect(sheet.locator(".ui-preview__card-length")).toHaveText("+ 2 s");
    const measured = await page.evaluate(async (chosen) => {
      const hooks = (globalThis as unknown as { untzelTest: { exportLab(): Promise<{ previewGeometry(format: string): PreviewGeometry }> } }).untzelTest;
      const { size, rects, markUrlCenter } = (await hooks.exportLab()).previewGeometry(chosen);
      const rect = (selector: string) => document.querySelector(`#ui-export ${selector}`)?.getBoundingClientRect();
      const relative = (inner: DOMRect | undefined, outer: DOMRect | undefined): Box | null =>
        inner === undefined || outer === undefined
          ? null
          : {
              x: ((inner.x - outer.x) / outer.width) * size.width,
              y: ((inner.y - outer.y) / outer.height) * size.height,
              w: (inner.width / outer.width) * size.width,
              h: (inner.height / outer.height) * size.height,
            };
      const frame = rect(".ui-preview__frame");
      const card = rect(".ui-preview__card-frame");
      const url = relative(rect(".ui-preview__mark-url"), frame);
      return {
        expected: rects,
        markUrlCenter,
        markUrl: url === null ? null : url.x + url.w / 2,
        frameSize: size.width,
        markLogo: relative(rect(".ui-preview__mark-logo"), frame),
        scrim: relative(rect(".ui-preview__scrim"), frame),
        cardLogo: relative(rect(".ui-preview__card-logo"), card),
        frameWidth: frame?.width ?? 0,
        cardWidth: card?.width ?? 0,
      };
    }, format);
    // One preview pixel is about 5 frame pixels at 210 px wide; the card is drawn smaller.
    for (const part of ["markLogo", "scrim", "cardLogo"] as const) {
      const got = measured[part];
      const want = measured.expected[part];
      const shown = part === "cardLogo" ? measured.cardWidth : measured.frameWidth;
      const tolerance = (measured.frameSize / shown) * 1.5;
      expect(got, part).not.toBeNull();
      for (const key of ["x", "y", "w", "h"] as const) {
        expect(Math.abs((got?.[key] ?? 0) - want[key]), `${format} ${part}.${key} at ${width}`).toBeLessThanOrEqual(tolerance);
      }
    }
    const urlTolerance = (measured.frameSize / measured.frameWidth) * 1.5;
    expect(Math.abs((measured.markUrl ?? 0) - measured.markUrlCenter), `${format} mark URL axis at ${width}`).toBeLessThanOrEqual(urlTolerance);
    await screenshot(page, format === "story" ? "export-preview-engine" : "export-preview-video-engine", width);
  }
});

test("the story: a valid MP4 with the mark on its light, a 2 s card and the sound in sync", async ({ playwright, baseURL }) => {
  // A browser of its own, so the first render here is the session's first.
  const fresh = await freshBrowserPage(playwright, baseURL);
  try {
    await storyInFreshBrowser(fresh.page);
  } finally {
    await fresh.close();
  }
});

async function storyInFreshBrowser(page: Page): Promise<void> {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  await stopMusic(page); // stopped: the story starts at bar 0, like the WAV of 8 bars
  const sheet = await openExport(page);
  await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 1 · 8 bars");
  await screenshot(page, "export-idle-engine", 390);
  const hd = sheet.getByRole("group", { name: "Quality" }).getByRole("button", { name: /^HD/ });
  // 497 frames at the seeded 120 frames/s is ~4 s; the session's first render adds the encoder's 2 s.
  await expect(hd).toHaveText(/about 6 s to render$/);
  const elapsed = await renderExport(page);
  await screenshot(page, "export-done-engine", 390);
  await expectAttribution(page);
  const total = totalFrames(0, 8);
  await saveExport(page, "story.mp4");
  const report = await inspectMp4(page);
  writeMeasurement("export-test-story", { elapsedMs: elapsed, ...report, cardFrames: report.cardFrames.slice(0, 2) });
  writeMeasurement("export-test-story-details", await details(page));
  expectMark(report);
  // The codec probe's retries on a busy machine are not the render's.
  const retryMs = (await details(page))?.codecRetryMs ?? 0;
  expect(elapsed - retryMs, "first story render of the browser session, HD, without codec retries").toBeLessThanOrEqual(FIRST_STORY_LIMIT_MS);
  expect(report).toMatchObject({ width: 1080, height: 1920, videoFrames: total, sampleRate: 48_000, channels: 2 });
  expect(report.firstVideoTimestamp).toBeCloseTo(0, 6);
  expect(report.lastVideoTimestamp).toBeCloseTo((total - 1) / 30, 6);
  expect(report.comment).toBe("Powered by Untzel · Techno Inspire · https://untzel.com");
  await expectAudioCoversVideo(page, report, total);
  expectCard(report, total);

  await sheet.getByRole("button", { name: /^Audio/ }).click();
  await sheet.getByLabel("Bars").selectOption("8");
  await renderExport(page);
  const wav = await inspectWav(page);
  writeMeasurement("export-test-alignment", { mp4: report.firstAttackSeconds, wav: wav.firstAttackSeconds });
  expect(report.firstAttackSeconds).not.toBeNull();
  expect(wav.firstAttackSeconds).not.toBeNull();
  expect(Math.abs((report.firstAttackSeconds ?? 0) - (wav.firstAttackSeconds ?? 0))).toBeLessThanOrEqual(ALIGNMENT_SECONDS);

  // Closing the sheet drops the kept files: the same story renders again, on a started encoder.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await openExport(page);
  await sheet.getByRole("button", { name: /^Story/ }).click();
  await expect(hd).toHaveText(/about 4 s to render$/);
  const warm = await renderExport(page);
  writeMeasurement("export-test-story-warm", { firstMs: elapsed, warmMs: warm, details: await details(page) });
  expect(warm, "story render at HD with the encoder started").toBeLessThanOrEqual(STORY_LIMIT_MS);
  expect(errors).toEqual([]);
}

test("Export while the loop plays: the story is delivered and stays ready as the bars go by", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  const barMs = (240 / 132) * 1_000;
  await startEngine(page, PHASE1_ONBOARD_PATH); // playing, loop mode: the story starts at the bar that is playing
  await seedDeviceProbe(page, false);
  await page.waitForTimeout(1.5 * barMs); // past bar 1, so the story does not start at 0
  const sheet = await openExport(page);
  await renderExport(page);
  const origin = (await sheet.locator(".ui-export__origin").textContent()) ?? "";
  const from = Number(/^from bar (\d+) · 8 bars$/.exec(origin)?.[1]) - 1;
  expect(from, `origin: ${origin}`).toBeGreaterThanOrEqual(1);
  // Two bars: the live position moves on; the finished story must not vanish.
  await page.waitForTimeout(2 * barMs);
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^Ready · /);
  await expect(sheet.locator(".ui-export__origin")).toHaveText(origin);
  await expect(sheet.getByRole("button", { name: "Download" })).not.toHaveAttribute("aria-disabled", "true");
  const total = totalFrames(from, 8);
  const report = await inspectMp4(page);
  writeMeasurement("export-test-story-playing", { origin, videoFrames: report.videoFrames, expected: total });
  expect(report).toMatchObject({ width: 1080, height: 1920, videoFrames: total });
  await expectAudioCoversVideo(page, report, total);
  expectCard(report, total);
  expectMark(report);
  expect(errors).toEqual([]);
});

test("a 16:9 video of one part starts on that part and ends with the card", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Song", exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => (globalThis as unknown as { untzelTest: { session(): { mode: string | null } } }).untzelTest.session().mode)), { timeout: 10_000 }).toBe("song");
  await stopMusic(page);
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: /^Video/ }).click();
  await sheet.getByRole("group", { name: "Range" }).getByRole("button", { name: "Song", exact: true }).click();
  await sheet.getByLabel("From").selectOption("1");
  await sheet.getByLabel("To", { exact: true }).selectOption("1");
  // The onboard's second part: intro is 8 bars, so it starts on bar 9.
  await expect(sheet.locator(".ui-export__origin")).toHaveText(/^from bar 9 · \d+ bars$/);
  const bars = Number(/· (\d+) bars$/.exec((await sheet.locator(".ui-export__origin").textContent()) ?? "")?.[1]);
  await renderExport(page);
  const total = totalFrames(8, bars);
  const report = await inspectMp4(page);
  expect(report).toMatchObject({ width: 1920, height: 1080, videoFrames: total });
  await expectAudioCoversVideo(page, report, total);
  expectCard(report, total);
  expectMark(report);
  await sheet.getByRole("button", { name: /^Audio/ }).click();
  await renderExport(page);
  const wav = await inspectWav(page);
  expect(Math.abs((report.firstAttackSeconds ?? -1) - (wav.firstAttackSeconds ?? 1))).toBeLessThanOrEqual(ALIGNMENT_SECONDS);
  expect(errors).toEqual([]);
});
