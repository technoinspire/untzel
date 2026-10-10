// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// In the track detail: Use Tone with
// Undo, the gain fader in dB, a pattern chip that previews then writes, and Change sound
// keeping the pattern. The music never stops.

import { expect, test, type Page } from "@playwright/test";
import { expectSoundThroughout, lineOf, sourceOf, startRms, startSession, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

interface Hooks {
  session(): { readonly trackPreview: { readonly track: string; readonly label: string } | null };
}

async function openDetail(page: Page, track: string, width: number): Promise<void> {
  if (width < 1200) await page.getByRole("button", { name: `Adjust ${track}`, exact: true }).click();
  else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: new RegExp(`^${track}`) }).click();
  await expect(page.locator("#ui-detail")).toBeVisible();
}

function trackPreview(page: Page): Promise<{ readonly track: string; readonly label: string } | null> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().trackPreview);
}

for (const width of [390, 1440] as const) {
  test(`Use Tone hands tone back and Undo brings open back, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    await openDetail(page, "ride", width);
    const tone = page.locator("#ui-detail .ui-tone");
    await tone.scrollIntoViewIfNeeded();
    await expect(tone.locator(".ui-tone__set-by")).toHaveText("Set by open");
    await expect(tone.getByRole("slider", { name: "tone" })).toHaveAttribute("aria-disabled", "true");
    await screenshot(page, "tc-tone-set-by", width);
    await tone.getByRole("button", { name: "Use Tone" }).click();
    await expect.poll(() => lineOf(page, "ride:")).not.toContain("open");
    const toast = page.locator(".ui-toast");
    await expect(toast.locator(".ui-toast__message")).toHaveText("open removed");
    await screenshot(page, "tc-use-tone", width);
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => lineOf(page, "ride:")).toContain("open 0.7");
    await expect(tone.locator(".ui-tone__set-by")).toHaveText("Set by open");
    expectSoundThroughout(await stopRms(page), "Use Tone");
    expect(errors).toEqual([]);
  });

  test(`the gain fader writes gain 1 at its 0 dB mark and reads dB, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    await openDetail(page, "hat", width);
    const fader = page.locator("#ui-detail .ui-fader").getByRole("slider", { name: "gain" });
    await fader.scrollIntoViewIfNeeded();
    const box = await fader.boundingBox();
    if (box === null) throw new Error("no fader");
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
    await expect.poll(() => lineOf(page, "hat:")).toMatch(/\| gain 0\.5\d\d?$|\| gain 0\.49\d$/);
    await expect(fader).toHaveAttribute("aria-valuetext", /^\u2212\d\.\d dB$/);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
    await expect.poll(() => lineOf(page, "hat:")).toMatch(/\| gain 1$/);
    await expect(fader).toHaveAttribute("aria-valuetext", "0.0 dB");
    await fader.press("ArrowDown");
    await expect.poll(() => lineOf(page, "hat:")).toMatch(/\| gain 0\.944$/);
    await expect(fader).toHaveAttribute("aria-valuetext", "\u22120.5 dB");
    await fader.dblclick();
    await expect.poll(() => lineOf(page, "hat:")).toMatch(/\| gain 1$/);
    await screenshot(page, "tc-gain-fader", width);
    expectSoundThroughout(await stopRms(page), "gain fader");
    expect(errors).toEqual([]);
  });

  test(`a pattern chip previews in the music, then Use writes it, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    const before = await sourceOf(page);
    await openDetail(page, "kick", width);
    const chips = page.locator("#ui-detail .ui-patterns");
    await expect(chips.getByRole("button", { name: "Four on the floor" })).toHaveAttribute("aria-pressed", "true");
    await chips.getByRole("button", { name: "Broken" }).click();
    await expect.poll(() => trackPreview(page)).toEqual(expect.objectContaining({ track: "kick", label: "Broken" }));
    expect(await sourceOf(page)).toBe(before);
    await expect(chips.locator(".ui-patterns__preview-title")).toHaveText("Previewing Broken");
    await screenshot(page, "tc-patterns", width);
    await chips.getByRole("button", { name: "Use Broken" }).click();
    await expect.poll(() => lineOf(page, "kick:")).toContain("x... ..x. ..x. .x..");
    expect(await trackPreview(page)).toBeNull();
    expectSoundThroughout(await stopRms(page), "pattern chip");
    expect(errors).toEqual([]);
  });

  test(`Change sound swaps the bass for acid and keeps its pattern, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    const pattern = (await lineOf(page, "bass:")).replace(/^bass:\s+bass\s+/, "").replace(/\s*\|.*$/, "");
    await openDetail(page, "bass", width);
    await page.getByRole("button", { name: /^Change sound of bass/ }).click();
    const sheet = page.locator("#ui-library");
    await expect(sheet.getByRole("heading", { name: "Change sound" })).toBeVisible();
    await expect(sheet.locator(".ui-sheet__hint")).toHaveText("bass keeps its pattern. These sounds play notes.");
    await expect(sheet.locator(".ui-library__row").filter({ hasText: /^kick/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Preview acid" }).click();
    await expect.poll(() => trackPreview(page)).toEqual(expect.objectContaining({ track: "bass" }));
    await screenshot(page, "tc-change-sound", width);
    await sheet.getByRole("button", { name: "Use acid for bass" }).click();
    await expect.poll(() => lineOf(page, "bass:")).toMatch(/^bass:\s+acid\s/);
    expect((await lineOf(page, "bass:")).replace(/^bass:\s+acid\s+/, "").replace(/\s*\|.*$/, "")).toBe(pattern);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(() => lineOf(page, "bass:")).toMatch(/^bass:\s+bass\s/);
    expectSoundThroughout(await stopRms(page), "Change sound");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440] as const) {
  test(`Add track lists the patterns under the sounds and adds the one heard, at ${width}`, async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[width]);
  await startSession(page);
  await page.getByRole("button", { name: "Add track" }).first().click();
  const sheet = page.locator("#ui-library");
  await sheet.getByRole("combobox").fill("kick");
  await sheet.getByRole("button", { name: "Preview kick" }).click();
  const group = sheet.getByRole("group", { name: "Patterns for kick" });
  await group.getByRole("button", { name: /^Broken/ }).click();
  await expect(sheet.locator(".ui-library__playing")).toContainText("Broken in c minor");
  await screenshot(page, "tc-add-track-patterns", width);
  await sheet.getByRole("button", { name: "Add kick · Broken" }).click();
  await expect.poll(() => lineOf(page, "kick2:")).toBe("kick2: kick x... ..x. ..x. .x..");
  expect(errors).toEqual([]);
});
}
