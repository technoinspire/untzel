// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Sharing and opening a link: copy it, open it on a new page, play exactly its text;
// broken links open the onboard with a message; links that arrive while playing.
import { expect, test, type Page } from "@playwright/test";
import {
  ONBOARD,
  PHRASE_TIMEOUT_MS,
  applyText,
  edited,
  expectAnnounced,
  expectPlaysRange,
  linkFragment,
  linkText,
  openShare,
  playMode,
  rangeLabel,
  remixOf,
  session,
  setPlayRange,
  startEngine,
  tapToPlay,
  watchBars,
} from "../../support/share-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot, sizedScreenshot } from "../../../../support/support";
import { contrast, decodePng, luminance } from "../../../../support/png";

/**
 * Opens the Share sheet and reads the link once it is built (it starts as pending, and a
 * reopened sheet keeps the previous link in its hidden field until the new one is ready).
 */
async function openLink(page: Page, expected: RegExp = /#v1\./): Promise<string> {
  await openShare(page);
  const field = page.locator("#ui-share").getByLabel("Link");
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(expected);
  return field.inputValue();
}

test("a copied link opens under Remix this, leaves the address bar and plays its text as a remix", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  const text = edited(124);
  await applyText(page, text);
  await openShare(page);
  const sheet = page.locator("#ui-share");
  await expect(sheet).toBeVisible();
  const field = sheet.getByLabel("Link");
  await expect(field).toHaveValue(/#v1\./);
  // One primary at 1440: Copy link.
  await expect(sheet.locator(".ui-pill--primary").filter({ visible: true })).toHaveCount(1);
  await expect(sheet.locator(".ui-pill--primary").filter({ visible: true })).toHaveText("Copy link");
  await sheet.getByRole("button", { name: "Copy link" }).click();
  await expect(sheet.getByRole("button", { name: "Link copied" })).toBeVisible();
  await expectAnnounced(page, "Link copied.");
  const url = await field.inputValue();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await screenshot(page, "share", 1440);
  await expectAttribution(page);

  const other = await context.newPage();
  const otherErrors = collectErrors(other);
  await other.setViewportSize(VIEWPORTS[390]);
  await other.goto(url);
  await expect(other.getByText("Remix this", { exact: true })).toBeVisible();
  await expect.poll(() => other.url()).not.toContain("#");
  await screenshot(other, "remix-engine", 390);
  await tapToPlay(other);
  expect((await session(other)).source).toBe(remixOf(text));
  expect(errors).toEqual([]);
  expect(otherErrors).toEqual([]);
});

// The link carries the sender's mode, beside the text. The onboard has a `song` line, so
// without the mode the fallback would open it in song. A copy the browser refuses is said
// in the page's polite region, with the keys that copy by hand.
test("a refused copy says Press Command+C or Ctrl+C in the live region", async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", { value: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) });
  });
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await openShare(page);
  const sheet = page.locator("#ui-share");
  await expect(sheet.getByLabel("Link")).toHaveValue(/#v1\./);
  await sheet.getByRole("button", { name: "Copy link" }).click();
  await expect(page.locator(".ui-app > [aria-live]")).toHaveText(/^Press (Command|Ctrl)\+C to copy\.$/, { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test("a link opens in the sender's mode: loop stays loop, song stays song", async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  expect((await session(page)).mode).toBe("loop");
  const loopUrl = await openLink(page, /#v1\..*&mode=loop$/);
  expect(await linkText(loopUrl)).toBe(ONBOARD);
  await page.keyboard.press("Escape");
  await playMode(page, "song");
  // A wrong mode never shows up: the field waits for the song link and times out otherwise.
  const songUrl = await openLink(page, /#v1\..*&mode=song$/);
  for (const [url, mode] of [[loopUrl, "loop"], [songUrl, "song"]] as const) {
    const other = await context.newPage();
    const otherErrors = collectErrors(other);
    await other.setViewportSize(VIEWPORTS[390]);
    await other.goto(url);
    await expect(other.getByText("Remix this", { exact: true })).toBeVisible();
    await tapToPlay(other);
    expect(await session(other), `sent in ${mode}`).toMatchObject({ source: remixOf(ONBOARD), mode, playing: true });
    // The receiver still switches freely.
    await playMode(other, mode === "loop" ? "song" : "loop");
    expect(otherErrors).toEqual([]);
    await other.close();
  }
  expect(errors).toEqual([]);
});

// The play range goes beside the mode, never in the text.
test("a link made with a range opens with that range and plays from its first bar", async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await setPlayRange(page, 2, 3);
  await expect(rangeLabel(page)).toHaveText("Range: bars 2–3");
  const url = await openLink(page, /#v1\..*&mode=loop&range=2-3$/);
  expect(await linkText(url), "the range never enters the text").toBe(ONBOARD);
  for (const size of [390, 1440] as const) {
    const other = await context.newPage();
    const otherErrors = collectErrors(other);
    await other.setViewportSize(VIEWPORTS[size]);
    await other.goto(url);
    await expect(other.getByText("Remix this", { exact: true })).toBeVisible();
    await screenshot(other, "range-link-idle", size);
    await watchBars(other);
    await tapToPlay(other);
    await expectPlaysRange(other, 2, 3);
    await expect(rangeLabel(other)).toHaveText("Range: bars 2–3");
    expect(await session(other)).toMatchObject({ source: remixOf(ONBOARD), mode: "loop", playing: true });
    await screenshot(other, "range-link-running", size);
    expect(otherErrors).toEqual([]);
    await other.close();
  }
  expect(errors).toEqual([]);
});

test("a link with a range that arrives while playing takes the range on the next bar", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  const fragment = `${await linkFragment(edited(118))}&mode=loop&range=3-4`;
  await page.evaluate((hash) => (window.location.hash = hash), fragment);
  await expectAnnounced(page, "The shared music plays on the next bar.");
  await expect(rangeLabel(page)).toHaveText("Range: bars 3–4");
  await expect.poll(async () => (await session(page)).source).toBe(remixOf(edited(118)));
  expect((await session(page)).playing, "the music never stopped").toBe(true);
  expect(errors).toEqual([]);
});

test("a link without a mode opens in song with a song line, in loop without one", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto(`./${await linkFragment(ONBOARD)}`);
  // The link is analyzed before the tap plays it: until Remix this shows, the tap plays the template.
  await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
  await tapToPlay(page);
  expect(await session(page)).toMatchObject({ source: remixOf(ONBOARD), mode: "song" });
  const loopOnly = ONBOARD.replace(/^song .*$/m, "");
  await page.goto("about:blank");
  await page.goto(`./${await linkFragment(loopOnly)}`);
  await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
  await tapToPlay(page);
  expect(await session(page)).toMatchObject({ source: remixOf(loopOnly), mode: "loop" });
  expect(errors).toEqual([]);
});

test("the open Share sheet follows the text: Copy link sends the version after a track change", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await openShare(page);
  const sheet = page.locator("#ui-share");
  const field = sheet.getByLabel("Link");
  await expect(field).toHaveValue(/#v1\./);
  const before = await field.inputValue();
  // The desktop panel leaves the track table and its shortcuts active beside it.
  await sheet.getByRole("button", { name: "Copy link" }).focus();
  await page.keyboard.press("1");
  await expect.poll(async () => (await session(page)).source).not.toBe(ONBOARD);
  await expect(field).not.toHaveValue(before);
  await expect(field).toHaveValue(/#v1\./);
  await sheet.getByRole("button", { name: "Copy link" }).click();
  await expectAnnounced(page, "Link copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(await linkText(copied)).toBe((await session(page)).source);
  expect(errors).toEqual([]);
});

test("a corrupted link opens the onboard with a message", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./#v1.____");
  await expect(page.locator(".ui-idle__notice")).toHaveText("This link could not be opened.");
  await expect.poll(() => page.url()).not.toContain("#");
  await tapToPlay(page);
  expect((await session(page)).source).toBe(ONBOARD);
  expect(errors).toEqual([]);
});

test("a template chosen after a link plays the template and the notice goes away", async ({ page, context }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await applyText(page, edited(120));
  const url = await openLink(page);
  const other = await context.newPage();
  await other.setViewportSize(VIEWPORTS[390]);
  await other.goto(url);
  await expect(other.getByText("Remix this", { exact: true })).toBeVisible();
  // A project card of the open style: the name comes from the "// template:" header.
  await other.getByRole("group", { name: "Start from a template" }).getByRole("button", { name: /^Midnight Bloom\b/ }).click();
  await expect(other.getByText("Remix this", { exact: true })).toBeHidden();
  await tapToPlay(other);
  expect((await session(other)).source).toBe(ONBOARD);
});

test("a link that arrives while playing: broken changes nothing, valid plays on the next bar", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await applyText(page, edited(118));
  const url = await openLink(page);
  await page.keyboard.press("Escape");
  await applyText(page, ONBOARD);
  await page.evaluate(() => (window.location.hash = "#v1.AAAA"));
  await expectAnnounced(page, "This link could not be opened.");
  expect((await session(page)).source).toBe(ONBOARD);
  await playMode(page, "song");
  await page.evaluate((hash) => (window.location.hash = hash), url.slice(url.indexOf("#")));
  await expectAnnounced(page, "The shared music plays on the next bar.");
  expect(await session(page)).toMatchObject({ source: remixOf(edited(118)), playing: true });
  // Sent in loop: the music goes back to loop on the next phrase.
  await expect.poll(async () => (await session(page)).mode, { timeout: PHRASE_TIMEOUT_MS }).toBe("loop");
  await expect.poll(() => page.url()).not.toContain("#");
  expect(errors).toEqual([]);
});
// "Remix this" sat under the top bar's scrim on a phone: its brightest pixel measured
// (157, 62, 4) on (10, 10, 12), 2.94:1, for 22 px text that needs 4.5:1. The pixel
// method: the brightest glyph pixel against the
// darkest pixel of the text's own box, on the composited screenshot.
async function remixContrast(page: Page): Promise<number> {
  const box = await page.locator(".ui-idle__remix-title").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    return { x: Math.floor(rect.left), y: Math.floor(rect.top), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  });
  const pixels = decodePng(await page.screenshot({ clip: box, scale: "css" }));
  let brightest = 0;
  let darkest = 1;
  for (let index = 0; index < pixels.width * pixels.height; index += 1) {
    const value = luminance(pixels.data[index * 4] ?? 0, pixels.data[index * 4 + 1] ?? 0, pixels.data[index * 4 + 2] ?? 0);
    brightest = Math.max(brightest, value);
    darkest = Math.min(darkest, value);
  }
  return contrast(brightest, darkest);
}
test("Remix this reads at 4.5:1 or more on the composited page, clear of the top bar's scrim", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  const url = `./${await linkFragment(edited(126))}`;
  for (const size of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 900 }] as const) {
    await page.setViewportSize(size);
    await page.goto(url);
    await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    const ratio = await remixContrast(page);
    expect(ratio, `Remix this at ${size.width}×${size.height}`).toBeGreaterThanOrEqual(4.5);
    await sizedScreenshot(page, `remix-notice-${size.width}x${size.height}`);
  }
  expect(errors).toEqual([]);
});
