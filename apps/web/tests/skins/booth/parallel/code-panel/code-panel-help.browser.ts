// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Help while typing: typing "kik" offers "Change
// to kick" and the music keeps playing; completion offers "open" after "ride: hat … |"
// and choosing it keeps the program valid.

import { expect, test } from "@playwright/test";
import { openCode, type Hooks } from "../../support/code-panel-support";
import { expectSoundThroughout, startRms, stopRms } from "../../support/session-support";
import { collectErrors, screenshot } from "../../../../support/support";

for (const width of [390, 1440] as const) {
  test(`quick fix at ${width}: typing kik offers Change to kick, the music keeps playing`, async ({ page }) => {
    const errors = collectErrors(page);
    await openCode(page, width);
    // Every 500 ms slice of the edit has sound, by the harness rule (a silence with no
    // underruns always fails), the same check as every other "the music keeps playing".
    await startRms(page);
    // A new track after the last one (tracks come before the sections).
    await page.locator(".cm-line", { hasText: /^bass:/ }).click();
    await page.keyboard.press("End");
    await page.keyboard.type("\nclap: kik .... x... .... x...");
    const fix = page.getByRole("button", { name: "Change to kick" });
    await expect(fix).toBeVisible();
    // The wavy underline sits on "kik" (CodeMirror may split it around nested spans).
    await expect(page.locator(".cm-lintRange-error").first()).toHaveText(/^k/);
    expect((await page.locator(".cm-lintRange-error").allTextContents()).join("")).toBe("kik");
    await screenshot(page, "code-panel-quick-fix", width);
    await fix.click();
    await expect.poll(async () => page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().valid)).toBe(true);
    await page.waitForTimeout(1_000);
    const rms = await stopRms(page);
    const source = await page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().source);
    expect(source).toContain("clap: kick .... x... .... x...");
    expectSoundThroughout(rms, "typing kik and its quick fix");
    expect(errors).toEqual([]);
  });
}

test("autocomplete offers open after ride: hat … |, and inserting it keeps the program valid", async ({ page }) => {
  const errors = collectErrors(page);
  await openCode(page, 1440);
  const line = page.locator(".cm-line", { hasText: /^ride:/ });
  await line.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" | o");
  const option = page.locator(".cm-tooltip-autocomplete li", { hasText: /^open/ });
  await expect(option).toBeVisible();
  await screenshot(page, "code-panel-completion", 1440);
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Enter");
  const state = await page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session());
  expect(state.source).toMatch(/^ride:.*\| open 0$/m);
  expect(state.valid).toBe(true);
  expect(errors).toEqual([]);
});
