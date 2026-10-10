// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The editor's keys against the page's shortcuts: one Mod+Z is one step back, Mod+.
// never stops the music inside the editor,
// the first Esc stays in the editor (Tab then leaves) and the second closes Code, and
// a new error in the code is said in the page's live region.

import { expect, test, type Page } from "@playwright/test";
import { openCode, type Hooks } from "../../support/code-panel-support";
import { VIEWPORTS, collectErrors, expectAttribution } from "../../../../support/support";

const RMS_THRESHOLD = 0.005;
const TEXT = "tempo 132\nkick:  kick  x... x... x... x...\nhat:   hat   ..x. ..x. ..x. ..xx\n";

const source = (page: Page): Promise<string> => page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().source);
const apply = (page: Page, text: string): Promise<void> =>
  page.evaluate((next) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.applyText(next), text);

/** The loudest RMS over a window: the music is still there. */
async function loudestRms(page: Page, ms: number): Promise<number> {
  return page.evaluate(async (windowMs) => {
    const test = (globalThis as unknown as { untzelTest: { rms(): number } }).untzelTest;
    let loudest = 0;
    const end = performance.now() + windowMs;
    while (performance.now() < end) {
      loudest = Math.max(loudest, test.rms());
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return loudest;
  }, ms);
}

async function focusLine(page: Page, line: number): Promise<void> {
  await page.locator("#ui-code .cm-line").nth(line - 1).click();
  await expect(page.locator("#ui-code .cm-content")).toBeFocused();
}

const status = (page: Page) => page.locator(".ui-app > [role='status']");

for (const width of [390, 1440] as const) {
  test(`editor keys at ${width}: one undo step, Mod+. keeps playing, Esc then Tab leaves, errors announced`, async ({ page }) => {
    const errors = collectErrors(page);
    await openCode(page, width, TEXT);

    // 132 → 124 → 128, then one Mod+Z inside the editor goes back to 124 only.
    await apply(page, TEXT.replace("tempo 132", "tempo 124"));
    await apply(page, TEXT.replace("tempo 132", "tempo 128"));
    await expect.poll(() => source(page)).toContain("tempo 128");
    await focusLine(page, 2);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => source(page)).toContain("tempo 124");
    await page.waitForTimeout(400);
    expect(await source(page), "one Mod+Z is exactly one step").toContain("tempo 124");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(() => source(page)).toContain("tempo 128");
    await page.waitForTimeout(400);
    expect(await source(page), "one Mod+Shift+Z is exactly one step").toContain("tempo 128");

    // No fix on a valid line; Mod+. says so and the music goes on.
    await focusLine(page, 1);
    await page.keyboard.press("ControlOrMeta+.");
    await expect(status(page)).toHaveText("No fix here.");
    expect(await loudestRms(page, 1500), "AnalyserNode RMS after Mod+.").toBeGreaterThan(RMS_THRESHOLD);

    // A new error is announced once, with its line.
    await apply(page, TEXT.replace("kick:  kick", "kick:  kik"));
    await expect(status(page)).toHaveText(/^Line 2: .*"kik".* The previous version keeps playing\.$/);

    // The editor with focus shows the 2 px white ring, and how to leave is its description
    // before any Esc.
    await apply(page, TEXT);
    await focusLine(page, 2);
    const ring = await page.locator("#ui-code .cm-editor").evaluate((node) => {
      const style = getComputedStyle(node);
      return { isFocused: node.classList.contains("cm-focused"), style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(ring).toEqual({ isFocused: true, style: "solid", width: "2px", color: "rgb(255, 255, 255)" });
    const content = page.locator("#ui-code .cm-content");
    await expect(content).toHaveAttribute("aria-describedby", "untzel-editor-leave-hint");
    await expect(content).toHaveAccessibleDescription("Esc, then Tab leaves the editor.");

    // Esc stays in the editor and Tab leaves it; Code stays open.
    await page.keyboard.press("Escape");
    await expect(page.locator("#ui-code")).toBeVisible();
    await expect(page.locator("#ui-code .cm-content")).toBeFocused();
    await expect(status(page)).toHaveText("Tab leaves the editor. Esc again closes Code.");
    const before = await source(page);
    await page.keyboard.press("Tab");
    await expect(page.locator("#ui-code .cm-content")).not.toBeFocused();
    expect(await source(page), "Tab after Esc does not indent").toBe(before);

    // A second Esc in a row closes Code.
    await focusLine(page, 2);
    await page.keyboard.press("Escape");
    await expect(page.locator("#ui-code")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#ui-code")).toBeHidden();
    // Two Esc from inside the editor close Code, and the focus goes back to its button.
    await expect(page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true })).toBeFocused();

    expect(await loudestRms(page, 1000), "the music never stopped").toBeGreaterThan(RMS_THRESHOLD);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
// In Song mode D and [ ] did nothing and said nothing: they keep
// the text as it is and say where they work.
test("D and ] in Song mode say they work in Loop mode and change nothing, at 1440", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.locator(".ui-transport").getByRole("button", { name: "Song", exact: true }).click();
  // Song enters on the next 4-bar phrase: at 124 BPM at most 7.8 s away.
  await expect(page.getByRole("list", { name: "Parts of the song" })).toBeVisible({ timeout: 20_000 });
  const before = await source(page);
  await page.keyboard.press("d");
  await expect(status(page)).toHaveText("Drop works in Loop mode.");
  await page.keyboard.press("]");
  await expect(status(page)).toHaveText("Loop length works in Loop mode.");
  expect(await source(page), "the text is untouched").toBe(before);
  expect(errors).toEqual([]);
});
