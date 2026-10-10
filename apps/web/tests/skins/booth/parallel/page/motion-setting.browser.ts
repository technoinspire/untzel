// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Reduced motion from one source: the system's value is on the root
// before the first paint, the menu's switch changes it at once, the light stage follows
// without a remount, and a sheet stops sliding.
import { expect, test } from "@playwright/test";
import { startEngine } from "../../support/share-support";

test("with the system asking for reduced motion and nothing saved, the switch is born On", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: /Reduced motion/ })).toHaveAttribute("aria-checked", "true");
});

test("the switch changes data-motion, the sheets stop sliding, the stage keeps its canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  const canvas = await page.locator(".ui-stage canvas").elementHandle();
  const renderer = await page.locator("html").getAttribute("data-renderer");
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Reduced motion/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".ui-sheet") as Element).transitionProperty === "none" || getComputedStyle(document.querySelector(".ui-sheet") as Element).transitionDuration === "0s")).toBe(true);
  expect(await page.locator(".ui-stage canvas").evaluate((node, before) => node === before, canvas)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-renderer", renderer ?? "");
  expect(await page.evaluate(() => localStorage.getItem("untzel.motion.reduced"))).toBe("on");
});

// The command line's bar pulse read only the system's preference,
// so with the menu's switch on and the system silent it still pulsed. Now the bar lights
// without moving.
test("with the menu's Reduced motion on, the command line's bar lights and does not pulse", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Reduced motion/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.keyboard.press("Escape");
  await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("button", { name: "Commands" }).click();
  const input = page.getByRole("combobox", { name: "Command" });
  // The default template plays at 124 BPM: 126 is a change, applied on the next bar.
  await input.fill("tempo 126");
  await input.press("Enter");
  await expect(page.getByRole("log").locator(".ut-applied__detail").last()).toHaveText(/playing since bar \d+/, { timeout: 6_000 });
  const beat = page.locator(".ut-beat");
  await expect(beat).toHaveClass(/ut-beat--lit/);
  await expect(beat).not.toHaveClass(/ut-beat--pulse/);
  expect(await beat.evaluate((node) => node.getAnimations().length)).toBe(0);
});
