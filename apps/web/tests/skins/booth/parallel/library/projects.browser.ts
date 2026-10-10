// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library on the real page: an edit is saved 1 s later, an
// untouched template saves nothing, a link opens as a new "Remix of" project that never
// overwrites one, projects survive a reload, and renaming, deleting and its Undo work
// from the Projects sheet while the music keeps playing.
import { expect, test, type Page } from "@playwright/test";
import { applyText, edited, expectPlaysRange, linkFragment, rangeLabel, session, setPlayRange, startEngine, tapToPlay, waitPlaying, watchBars } from "../../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

const menu = (page: Page) => page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true });

async function openProjects(page: Page): Promise<void> {
  await menu(page).click();
  await page.getByRole("menuitem", { name: /^Open project/ }).click();
  await expect(page.locator("#ui-projects")).toBeVisible();
}

async function projectTitles(page: Page): Promise<string[]> {
  return page.locator("#ui-projects .ui-project__title").allTextContents();
}

test("an edit is saved and the next visit continues it", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await applyText(page, edited(121));
  await page.waitForTimeout(1_500);
  await page.goto("./");
  await tapToPlay(page, "Continue Midnight Bloom");
  expect((await session(page)).source).toBe(edited(121));
  expect(errors).toEqual([]);
});

// The project keeps its mode and range beside the text.
test("a reopened project keeps its play range, also one set after the last edit", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await setPlayRange(page, 2, 3);
  await applyText(page, edited(121));
  await page.waitForTimeout(1_500);
  await page.goto("./");
  await watchBars(page);
  await tapToPlay(page, "Continue Midnight Bloom");
  await expectPlaysRange(page, 2, 3);
  await expect(rangeLabel(page)).toHaveText("Range: bars 2–3");
  // Only the range changes now: no text edit, and the project still keeps it.
  await setPlayRange(page, 3, 4);
  await expect(rangeLabel(page)).toHaveText("Range: bars 3–4");
  await page.waitForTimeout(500);
  await page.goto("./");
  await tapToPlay(page, "Continue Midnight Bloom");
  await expect(rangeLabel(page)).toHaveText("Range: bars 3–4");
  expect((await session(page)).source).toBe(edited(121));
  expect(errors).toEqual([]);
});

test("a template played without an edit saves nothing", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await page.waitForTimeout(1_500);
  await page.goto("./");
  await expect(page.getByRole("button", { name: /^Continue / })).toBeHidden();
});

test("a link opens as a Remix of project and never overwrites the one before", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await applyText(page, edited(119));
  await page.waitForTimeout(1_500);
  await page.goto("about:blank");
  // The link is checked by the engine's code before the tap: wait for "Remix this".
  await page.goto(`./${await linkFragment(edited(140))}`);
  await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
  await tapToPlay(page);
  const remix = (await session(page)).source;
  expect(remix).toContain('title "Remix of Midnight Bloom"');
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remix of Midnight Bloom");
  await applyText(page, remix.replace("tempo 140", "tempo 141"));
  await page.waitForTimeout(1_500);
  await openProjects(page);
  await expect.poll(() => projectTitles(page)).toEqual(["Remix of Midnight Bloom", "Midnight Bloom"]);
});

test("two projects survive a reload; rename, delete and Undo from the sheet while the music plays", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await applyText(page, edited(118));
  await page.waitForTimeout(1_500);
  // A second project, from New project…: the music stops, the template waits for the tap.
  await menu(page).click();
  await page.getByRole("menuitem", { name: /^New project/ }).click();
  await expect(page.getByRole("button", { name: "Tap to play" })).toBeVisible();
  await page.locator(".ui-styles__card").filter({ hasText: "Night Petals" }).click();
  await tapToPlay(page);
  const petals = (await session(page)).source;
  await applyText(page, petals.replace(/^tempo \d+$/m, "tempo 120"));
  await page.waitForTimeout(1_500);
  await page.reload();
  await page.waitForTimeout(1_000);
  await openProjects(page);
  await expect.poll(() => projectTitles(page)).toEqual(["Night Petals", "Midnight Bloom"]);
  await page.keyboard.press("Escape");
  await tapToPlay(page, "Continue Night Petals");
  // Rename the other one from the sheet: its text gets the title line, nothing plays differently.
  await openProjects(page);
  await page.getByRole("button", { name: "Rename Midnight Bloom" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Harbour Lights");
  await page.keyboard.press("Enter");
  await expect.poll(() => projectTitles(page)).toContain("Harbour Lights");
  await page.getByRole("button", { name: "Delete Harbour Lights" }).click();
  await expect.poll(() => projectTitles(page)).toEqual(["Night Petals"]);
  await expect(page.locator(".ui-toast")).toContainText("Harbour Lights deleted");
  await page.locator(".ui-toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => projectTitles(page)).toContain("Harbour Lights");
  expect((await session(page)).playing).toBe(true);
  expect(errors).toEqual([]);
});

test("a rename right before New project… is kept in the project it was made in", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await applyText(page, edited(118));
  await page.waitForTimeout(1_500);
  // Well inside the autosave's 1 s: the switch itself stores the rename.
  await page.getByRole("heading", { level: 1 }).getByRole("button").click();
  await page.getByRole("textbox", { name: "Song title" }).fill("Harbour Lights");
  await page.keyboard.press("Enter");
  await menu(page).click();
  await page.getByRole("menuitem", { name: /^New project/ }).click();
  await expect(page.getByRole("button", { name: "Tap to play" })).toBeVisible();
  await page.reload();
  await tapToPlay(page, "Continue Harbour Lights");
  expect((await session(page)).source).toContain('title "Harbour Lights"');
  await openProjects(page);
  await expect.poll(() => projectTitles(page)).toEqual(["Harbour Lights"]);
  expect(errors).toEqual([]);
});

test("the single saved session of before becomes the first project", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./");
  await page.evaluate((source) => localStorage.setItem("untzel:last-session", JSON.stringify({ v: 1, source, savedAt: "2026-10-02T10:00:00.000Z" })), edited(117));
  await page.reload();
  await page.getByRole("button", { name: "Continue Midnight Bloom" }).click();
  await waitPlaying(page);
  expect((await session(page)).source).toBe(edited(117));
  expect(await page.evaluate(() => localStorage.getItem("untzel:last-session"))).toBeNull();
});
