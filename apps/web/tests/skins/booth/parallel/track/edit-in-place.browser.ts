// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Names, tempo and key edited where they are
// shown, touch Undo and Redo, and the Blank project. Each edit is one undo step and the
// music never stops (the AnalyserNode RMS stays up through every edit).

import { expect, test, type Page } from "@playwright/test";
import { expectSoundThroughout, lineOf, sourceOf, startRms, startSession, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

interface Hooks {
  session(): { readonly playing: boolean; readonly mode: string | null };
}

async function openDetail(page: Page, track: string, width: number): Promise<void> {
  if (width < 1200) await page.getByRole("button", { name: `Adjust ${track}`, exact: true }).click();
  else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: new RegExp(`^${track}`) }).click();
  await expect(page.locator("#ui-detail")).toBeVisible();
}

for (const width of [390, 1440] as const) {
  test(`rename hat to hats: the sections follow, one undo step, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    await openDetail(page, "hat", width);
    // The name is the button's label, so the dialog and its heading read "hat";
    // what it does is the description.
    const button = page.locator("#ui-detail").getByRole("button", { name: "hat", exact: true });
    await expect(button).toHaveAccessibleDescription("Rename track");
    await expect(page.getByRole("dialog", { name: "hat", exact: true })).toBeVisible();
    await expect(page.locator("#ui-detail").getByRole("heading", { level: 2 })).toHaveAccessibleName("hat");
    expect(Math.round((await button.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await button.click();
    const field = page.getByRole("textbox", { name: "Track name" });
    await field.fill("kick");
    await expect(page.locator("#ui-detail .ui-inline-name__rule")).toHaveText("A track named kick already exists. Pick another name.");
    await field.fill("open hat");
    await screenshot(page, "tc-rename-error", width);
    await field.fill("hats");
    await field.press("Enter");
    await expect.poll(() => lineOf(page, "hats:")).toContain("hat");
    const source = await sourceOf(page);
    expect(source).toMatch(/section intro +kick hats sub/);
    expect(source).not.toMatch(/section \w+ .*\bhat\b(?!s)/);
    await screenshot(page, "tc-rename", width);
    // The detail follows the new name: its sliders write to hats, not to the old hat.
    await page.locator("#ui-detail").getByRole("slider", { name: "pan", exact: true }).fill("575");
    await expect.poll(() => lineOf(page, "hats:")).toMatch(/\| pan 0\.15$/);
    // Undo takes the pan back, then the rename in one more step.
    const undo = process.platform === "darwin" ? "Meta+z" : "Control+z";
    await page.keyboard.press(undo);
    await expect.poll(() => lineOf(page, "hats:")).not.toMatch(/\| pan 0\.15$/);
    await page.keyboard.press(undo);
    await expect.poll(() => lineOf(page, "hat:")).not.toBe("");
    expectSoundThroughout(await stopRms(page), "rename");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });

  test(`tempo 128 and key d dorian from the transport, touch Undo and Redo, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    const tempo = page.getByRole("button", { name: "Tempo, 132 BPM" });
    await tempo.click();
    const field = page.getByRole("spinbutton", { name: "BPM" });
    await field.fill("320");
    await field.press("Enter");
    await expect(page.locator(".ui-tempo__message")).toHaveText("Tempo runs from 40 to 300 BPM. 132 keeps playing.");
    await field.fill("128");
    await field.press("Enter");
    await expect.poll(() => lineOf(page, "tempo ")).toBe("tempo 128");
    await screenshot(page, "tc-tempo", width);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Key, c minor" }).click();
    await page.getByRole("radio", { name: "D", exact: true }).click();
    await page.getByRole("radio", { name: /^dorian/ }).click();
    await expect.poll(() => lineOf(page, "key ")).toBe("key d dorian");
    await screenshot(page, "tc-key", width);
    await page.keyboard.press("Escape");
    if (width < 1200) {
      const undo = page.locator(".ui-transport").getByRole("button", { name: "Undo" });
      expect((await undo.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await undo.click();
      await expect(page.locator(".ui-toast__message")).toHaveText("Undid: key");
      await expect.poll(() => lineOf(page, "key ")).toBe("key c minor");
      await page.locator(".ui-transport").getByRole("button", { name: "Redo" }).click();
      await expect(page.locator(".ui-toast__message")).toHaveText("Redid: key");
      await expect.poll(() => lineOf(page, "key ")).toBe("key d dorian");
      await screenshot(page, "tc-undo-redo", width);
    } else {
      await page.getByRole("button", { name: "Code", exact: true }).first().click();
      const header = page.locator("#ui-code .ui-sheet__header");
      await header.getByRole("button", { name: "Undo" }).click();
      await expect(page.locator(".ui-toast__message")).toHaveText("Undid: key");
      await expect.poll(() => lineOf(page, "key ")).toBe("key c minor");
      await header.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => lineOf(page, "tempo ")).toBe("tempo 132");
      await expect(header.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-disabled", "true");
      await screenshot(page, "tc-undo-redo", width);
    }
    expectSoundThroughout(await stopRms(page), "tempo and key");
    expect(errors).toEqual([]);
  });

  test(`Blank, Start from scratch, then Kick plays, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./?template=blank");
    await screenshot(page, "tc-blank-idle", width);
    await page.getByRole("button", { name: "Start from scratch" }).click();
    await expect(page.getByRole("heading", { name: "Start with a sound" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add track" }).first()).toBeVisible();
    // The test hooks arrive with the boot chunk, which can land after the empty state shows.
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.session().playing ?? null)).toBe(false);
    await screenshot(page, "tc-blank-empty", width);
    await page.getByRole("button", { name: "Add kick and play" }).click();
    await expect.poll(() => lineOf(page, "kick:")).toBe("kick: kick x... x... x... x...");
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().playing)).toBe(true);
    await startRms(page);
    expectSoundThroughout(await stopRms(page), "the first starter");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440] as const) {
  test(`rename the part drop to peak: the song follows, one undo step, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await page.evaluate(() => (globalThis as unknown as { untzelTest: { play(mode: "song"): unknown } }).untzelTest.play("song"));
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().mode), { timeout: 15_000 }).toBe("song");
    if (width < 1200) await page.getByRole("navigation").getByRole("button", { name: "Song" }).click();
    await startRms(page);
    const pencil = page.getByRole("button", { name: "Rename part drop" }).first();
    expect(Math.round((await pencil.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await pencil.click();
    const field = page.getByRole("textbox", { name: "Part name" });
    await field.fill("build");
    await expect(page.locator("#ui-part .ui-inline-name__rule")).toHaveText("A part named build already exists.");
    await field.fill("peak");
    await expect(page.locator("#ui-part .ui-part__follows")).toHaveText("drop plays 2 times in the song. Both follow.");
    await screenshot(page, "tc-rename-part", width);
    await field.press("Enter");
    await expect.poll(() => lineOf(page, "song ")).toBe("song intro 8, build 4, peak 16, break 8, build 4, peak 16");
    expect(await lineOf(page, "section peak")).not.toBe("");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(() => lineOf(page, "song ")).toBe("song intro 8, build 4, drop 16, break 8, build 4, drop 16");
    expectSoundThroughout(await stopRms(page), "rename part");
    expect(errors).toEqual([]);
  });
}
