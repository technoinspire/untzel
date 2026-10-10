// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Smoke tests of the real page: tap to play produces sound on the real engine, the
// attribution stays visible, and every main state renders without a console error.

import { expect, test } from "@playwright/test";
import { VIEWPORTS, collectErrors, expectAttribution, expectCopyrightNotice, screenshot, type ViewportWidth } from "../../../../support/support";

interface Hooks {
  stats(): { lateDrops: number; queueDrops: number; nanResets: number; unknownTargets: number; unknownMessages: number } | null;
  startFrame(): number | null;
  contextState(): string;
  rms(): number;
}

/** Peak-free RMS of the analyser over 2048 samples; the onboard's kick alone is far above. */
const RMS_THRESHOLD = 0.005;
const WIDTHS = Object.keys(VIEWPORTS).map(Number) as ViewportWidth[];

const hooks = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const t = (globalThis as unknown as { untzelTest?: Hooks }).untzelTest;
    if (t === undefined) return null;
    return { stats: t.stats(), startFrame: t.startFrame(), state: t.contextState(), rms: t.rms() };
  });

for (const width of [390, 1440] as const) {
  test(`attribution is visible at ${width}, idle and playing`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await expectAttribution(page);
    await expectCopyrightNotice(page);
    // Before the first play Export shows inert, says why and opens nothing; Share left the
    // bar for the menu.
    const topBar = page.locator(".ui-topbar");
    const exporter = topBar.getByRole("button", { name: "Export", exact: true });
    await expect(exporter, "Export is inert while waiting").toHaveAttribute("aria-disabled", "true");
    await expect(exporter).toHaveAccessibleDescription("Press play first");
    await exporter.click({ force: true });
    await expect(page.locator(".ui-app"), "Export opens nothing while waiting").toHaveAttribute("data-overlay", "none");
    await expect(topBar.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await expectAttribution(page);
    await expect(exporter, "Export acts while playing").not.toHaveAttribute("aria-disabled", "true");
    expect(errors).toEqual([]);
  });
}

test("tap to play makes sound on the real engine", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./");
  // With no project the h1 names the app for screen readers; the linked wordmark
  // beside it is what the eye reads.
  await expect(page.getByRole("heading", { level: 1, name: "Untzel" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Untzel" })).toBeVisible();
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.waitForFunction(() => {
    const t = (globalThis as unknown as { untzelTest?: Hooks }).untzelTest;
    return t !== undefined && t.contextState() === "running" && t.startFrame() !== null && t.stats() !== null;
  });
  let loudest = 0;
  for (let attempt = 0; attempt < 20 && loudest <= RMS_THRESHOLD; attempt += 1) {
    await page.waitForTimeout(100);
    loudest = Math.max(loudest, (await hooks(page))?.rms ?? 0);
  }
  expect(loudest, "AnalyserNode RMS").toBeGreaterThan(RMS_THRESHOLD);
  const reading = await hooks(page);
  expect((reading?.startFrame ?? 1) % 128).toBe(0);
  expect(reading?.stats).toMatchObject({ lateDrops: 0, queueDrops: 0, nanResets: 0, unknownTargets: 0, unknownMessages: 0 });
  await expect(page.getByText("kick", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  for (const width of WIDTHS) {
    await page.setViewportSize(VIEWPORTS[width]);
    await page.waitForTimeout(250);
    await screenshot(page, "engine-playing", width);
  }
  // The Loop / Song selector is in the desktop transport bar.
  await page.setViewportSize(VIEWPORTS[1440]);
  const songMode = page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Song", exact: true });
  await songMode.click();
  // Song enters on the next 4-bar phrase: at most 4 × 1.94 s at the onboard's 124 BPM.
  await expect(songMode).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  const play = page.getByRole("button", { name: "Play", exact: true });
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("a failed DSP download shows Retry, never a blank page", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.abort());
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Untzel couldn't load. Check your connection and try again.").first()).toBeVisible();
  await expectAttribution(page);
});

// The screen states over the fake session (?sim=1), with the data of the wireframes,
// for the contact sheet next to them.
const STATES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "desktop-track",
  "desktop-code",
  "collapsed",
  "collapsed-code",
  "desktop-collapsed",
  "load-failed",
  "unsupported",
  "share",
  "share-too-long",
  "remix",
  "link-failed",
  "export-rendering",
  "export-done",
  "export-idle",
  "export-failed",
] as const;
for (const state of STATES) {
  test(`state ${state} renders at every width`, async ({ page }) => {
    const errors = collectErrors(page);
    for (const width of WIDTHS) {
      await page.setViewportSize(VIEWPORTS[width]);
      await page.goto(`./?sim=1&screen=${state}&data=wireframe&still=1`);
      await page.locator(".ui-app").waitFor();
      await page.waitForTimeout(400);
      await screenshot(page, state, width);
      await expectAttribution(page);
    }
    expect(errors).toEqual([]);
  });
}
