// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// "I can't lower the volume". The slider
// rows of the track detail outlive the track they were made for, and once wrote to the
// first track opened (Mix) or the first track of the same instrument (Sound). On the real
// session at 390 and 1440: open sub, then bass (both bass), move gain and cutoff of bass,
// and only the bass line changes; then hat and ride (both hat), and only ride changes.

import { expect, test, type Page } from "@playwright/test";
import { lineOf, startSession } from "../../support/session-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

async function openDetail(page: Page, track: string, isPhone: boolean): Promise<void> {
  if (isPhone) await page.getByRole("button", { name: `Adjust ${track}`, exact: true }).click();
  else await page.locator(".ui-tracktable .ui-table__name").filter({ has: page.locator(".ui-table__track", { hasText: new RegExp(`^${track}$`) }) }).click();
  await expect(page.locator("#ui-detail .ui-sheet__title")).toHaveText(track);
}

for (const width of [390, 1440] as const) {
  test(`sliders write to the track shown, not the first one opened, at ${width}`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    const isPhone = width < 700;
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    const detail = page.locator("#ui-detail");
    const sub = await lineOf(page, "sub:");
    const hat = await lineOf(page, "hat:");

    await openDetail(page, "sub", isPhone);
    await page.keyboard.press("Escape");
    await openDetail(page, "bass", isPhone);
    // gain is the dB fader: one arrow is 0.5 dB, 1 → 0.944.
    await detail.getByRole("slider", { name: "gain" }).press("ArrowDown");
    await detail.getByLabel("cutoff", { exact: true }).fill("800");
    await expect.poll(() => lineOf(page, "bass:")).toMatch(/\| gain 0\.944\b/);
    await expect.poll(() => lineOf(page, "bass:")).not.toContain("sine(8)");
    expect(await lineOf(page, "sub:"), "sub keeps its line").toBe(sub);
    expect(await lineOf(page, "kick:"), "kick keeps its line").not.toContain("gain");

    await page.keyboard.press("Escape");
    await openDetail(page, "hat", isPhone);
    await page.keyboard.press("Escape");
    await openDetail(page, "ride", isPhone);
    // ride is at gain 0.4 (−8.0 dB): 0.5 dB down is 0.378.
    await detail.getByRole("slider", { name: "gain" }).press("ArrowDown");
    await expect.poll(() => lineOf(page, "ride:")).toMatch(/\| gain 0\.378\b/);
    expect(await lineOf(page, "hat:"), "hat keeps its line").toBe(hat);
    expect(errors).toEqual([]);
  });
}

// One arrow on a 0..1000 slider once moved 1/1000, so neither the label nor the text
// changed (decay 850 → 851 still "0.90 s"). Now an arrow
// moves 1%, Shift with an arrow 0.1%, Home and End go to the ends.
test("an arrow on decay moves 1% and changes the label and the text, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  await openDetail(page, "kick", true);
  const decay = page.locator("#ui-detail").getByLabel("decay", { exact: true });
  const before = Number(await decay.inputValue());
  const label = await decay.getAttribute("aria-valuetext");
  await decay.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await decay.inputValue())).toBe(before + 10);
  await expect(decay).not.toHaveAttribute("aria-valuetext", label ?? "");
  await expect.poll(() => lineOf(page, "kick:")).toMatch(/\| decay \d/);
  await page.keyboard.press("Shift+ArrowRight");
  expect(Number(await decay.inputValue())).toBe(before + 11);
  await page.keyboard.press("End");
  expect(await decay.inputValue()).toBe("1000");
  await page.keyboard.press("Home");
  expect(await decay.inputValue()).toBe("0");
  expect(errors).toEqual([]);
});

test("an arrow on the table's tone moves 1% and changes its value, at 1440", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startSession(page);
  const tone = page.getByRole("slider", { name: /tone/i }).and(page.locator(".ui-table__tone:not([aria-disabled='true'])")).first();
  await tone.focus();
  await page.keyboard.press("Home");
  expect(await tone.inputValue()).toBe("0");
  await expect(tone).toHaveAttribute("aria-valuetext", "0.00");
  for (let press = 0; press < 3; press += 1) await page.keyboard.press("ArrowRight");
  expect(await tone.inputValue()).toBe("30");
  await expect(tone).toHaveAttribute("aria-valuetext", "0.03");
  await page.keyboard.press("PageUp");
  expect(await tone.inputValue()).toBe("130");
  expect(errors).toEqual([]);
});
