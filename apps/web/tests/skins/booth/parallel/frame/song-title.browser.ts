// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song title in the bar on the real session: renaming writes the
// title line through setTitle, Esc cancels, empty keeps the old title, the field stops at
// 60 code points, Rename song in the menu opens the same field, the tab follows, an undo
// takes the rename back, and the music never stops.
import { expect, test, type Page } from "@playwright/test";
import { session, startEngine } from "../../support/share-support";
import { collectErrors } from "../../../../support/support";

const titleLine = async (page: Page): Promise<string> => (await session(page)).source.split("\n").find((line) => line.startsWith("title ")) ?? "";
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const field = (page: Page) => page.getByRole("textbox", { name: "Song title" });

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`renaming in the bar writes the title line at ${viewport.width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await startEngine(page);
    await expect(heading(page)).toHaveText("Midnight Bloom");
    await expect(page).toHaveTitle("Midnight Bloom · Untzel");
    const rename = heading(page).getByRole("button", { name: "Midnight Bloom" });
    await expect(rename).toHaveAccessibleDescription("Rename song");
    await rename.click();
    await expect(field(page)).toBeFocused();
    // While editing the h1 still names the song.
    await expect(heading(page)).toHaveText("Midnight Bloom");
    await field(page).fill("Midnight Coast");
    await page.keyboard.press("Enter");
    await expect.poll(() => titleLine(page)).toBe('title "Midnight Coast"');
    await expect(heading(page)).toHaveText("Midnight Coast");
    await expect(page).toHaveTitle("Midnight Coast · Untzel");
    await expect(page.locator(".ui-app > [role='status']")).toHaveText("Renamed to Midnight Coast.");
    // Esc cancels; empty keeps the title.
    await heading(page).getByRole("button").click();
    await field(page).fill("Something else");
    await page.keyboard.press("Escape");
    expect(await titleLine(page)).toBe('title "Midnight Coast"');
    await heading(page).getByRole("button").click();
    await field(page).fill("   ");
    await page.keyboard.press("Enter");
    expect(await titleLine(page)).toBe('title "Midnight Coast"');
    await expect(page.locator(".ui-app > [role='status']")).toHaveText("The song keeps its name.");
    // 61 code points stop at 60.
    await heading(page).getByRole("button").click();
    await field(page).fill("");
    await page.keyboard.type("a".repeat(61));
    await expect(field(page)).toHaveValue("a".repeat(60));
    await page.keyboard.press("Enter");
    await expect.poll(() => titleLine(page)).toBe(`title "${"a".repeat(60)}"`);
    expect((await session(page)).playing).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("Rename song in the menu opens the same field; Mod+Z takes the rename back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename song" }).click();
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("Harbour Lights");
  await page.keyboard.press("Enter");
  await expect.poll(() => titleLine(page)).toBe('title "Harbour Lights"');
  await page.locator(".ui-tracktable").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => titleLine(page)).toBe('title "Midnight Bloom"');
  await expect(heading(page)).toHaveText("Midnight Bloom");
});
