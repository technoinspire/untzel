// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Space plays and pauses after a click on a control: the clicked
// button keeps focus, but Space must not press it again. Reached by the keyboard, the
// control keeps Space (Tab to Mute, Space mutes).
import { expect, test } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

const isPlaying = (text: string | null): boolean => /bar \d+ of/.test(text ?? "");

test("Space plays and pauses after clicking Loop and a track's Solo", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto("./?template=house/sunday-piano");
  await page.getByRole("button", { name: "Tap to play" }).click();
  const where = page.locator(".ui-transport__position, .ui-transport__where").first();
  await expect.poll(async () => isPlaying(await where.textContent())).toBe(true);
  const mode = await page.locator(".ui-app").getAttribute("data-mode");
  for (const target of [page.getByRole("button", { name: "Loop", exact: true }).first(), page.locator("[role='row'] button[aria-pressed]").nth(2)]) {
    await target.click();
    // The click's own view draws on the next frame: read the state after it.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const pressed = await target.getAttribute("aria-pressed");
    await page.keyboard.press("Space");
    await expect.poll(async () => isPlaying(await where.textContent()), "Space pauses").toBe(false);
    await page.keyboard.press("Space");
    await expect.poll(async () => isPlaying(await where.textContent()), "Space plays").toBe(true);
    expect(await target.getAttribute("aria-pressed"), "Space did not press the clicked button").toBe(pressed);
  }
  expect(await page.locator(".ui-app").getAttribute("data-mode")).toBe(mode);
  expect(errors).toEqual([]);
});

test("a control reached with Tab keeps Space", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto("./?template=house/sunday-piano");
  await page.getByRole("button", { name: "Tap to play" }).click();
  const mute = page.locator("[role='row'] button[aria-pressed]").nth(2);
  await mute.click();
  const before = await mute.getAttribute("aria-pressed");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(mute).toBeFocused();
  await page.keyboard.press("Space");
  await expect(mute).not.toHaveAttribute("aria-pressed", before ?? "");
});
