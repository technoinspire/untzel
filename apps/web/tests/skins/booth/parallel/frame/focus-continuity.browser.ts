// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The focus never falls to the body when the control that had it hides, on the real
// session: Tap to play by Enter hands it to Play; the blank project opens on Add track; a
// failed load hands it to Retry. It once fell to the body after Tap to play and after the
// failure.
import { expect, test } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

for (const width of [390, 1440] as const) {
  test(`Tap to play by Enter hands the focus to Play at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await page.getByRole("button", { name: "Tap to play" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await expect(page.locator(".ui-transport__play")).toBeFocused();
    // The focus is usable: Space stops the music from there.
    await page.keyboard.press("Space");
    await expect(page.locator(".ui-transport__play")).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });

  test(`Start from scratch by Enter opens on Add track at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./?template=blank");
    await page.getByRole("button", { name: "Start from scratch" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Start with a sound" })).toBeVisible();
    await expect(page.locator(":focus")).toHaveAccessibleName("Add track");
    expect(errors).toEqual([]);
  });
}

test("a failed load hands the focus to Retry", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.abort());
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).focus();
  await page.keyboard.press("Enter");
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await expect(retry).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Untzel couldn't load" })).toHaveCount(1);
});
