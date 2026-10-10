// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Hiding the controls, and Code beside Drop, on the real session: the toggle hides the
// editing area and the stage
// grows, H toggles it, the state survives a reload, the music never stops, and the Code
// button next to Drop opens and closes the code view. Attribution stays visible throughout.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectSoundThroughout, startRms, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution } from "../../../../support/support";

interface Hooks {
  contextState(): string;
}

async function startEngine(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
}

const stageHeight = (page: Page): Promise<number> =>
  page.locator(".ui-stage").evaluate((node) => node.getBoundingClientRect().height);

/** The stage settles after the 200 ms ease-out. */
async function settledStageHeight(page: Page): Promise<number> {
  await page.waitForFunction(() => document.querySelector(".ui-app")?.getAttribute("data-transition") === null);
  return stageHeight(page);
}

async function expectTransportInReach(page: Page): Promise<void> {
  const transport = page.locator(".ui-transport");
  await expect(transport.getByRole("button", { name: "Play", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(transport.getByRole("button", { name: "Drop", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(transport.getByRole("button", { name: "Code", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(transport.locator(".ui-transport__toggle")).toBeInViewport({ ratio: 1 });
}

/** Opens and closes the code view from the button next to Drop. */
async function codeRoundTrip(page: Page, code: Locator): Promise<void> {
  await expect(code).toHaveAttribute("aria-pressed", "false");
  await code.click();
  await expect(page.locator("#ui-code")).toBeVisible();
  await expect(code).toHaveAttribute("aria-pressed", "true");
  await expect(code, "Code stays in reach while the code is open").toBeInViewport({ ratio: 1 });
  await expectAttribution(page);
  await code.click();
  await expect(page.locator("#ui-code")).toBeHidden({ timeout: 2_000 });
  await expect(code).toHaveAttribute("aria-pressed", "false");
  await expect(code, "focus stays on Code after closing").toBeFocused();
}

for (const width of [390, 1440] as const) {
  test(`controls hide and show without stopping the music at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await startEngine(page);

    const app = page.locator(".ui-app");
    const editing = page.locator(width === 390 ? ".ui-view--tracks" : ".ui-tracktable");
    const toggle = page.locator(".ui-transport__toggle");
    const code = page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true });
    await expect(editing).toBeVisible();
    await expect(toggle).toHaveAccessibleName("Hide controls");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "ui-editing ui-views-nav");
    const shown = await stageHeight(page);

    await startRms(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName("Show controls");
    await expect(toggle, "focus stays on the toggle").toBeFocused();
    await expect(editing).toBeHidden();
    await expect(page.locator("#ui-editing")).toBeHidden();
    if (width === 390) await expect(page.locator("#ui-views-nav")).toBeHidden();
    const hidden = await settledStageHeight(page);
    expect(hidden, "the stage takes the freed space").toBeGreaterThan(shown + 300);
    await expectTransportInReach(page);
    await expectAttribution(page);
    expect(await page.evaluate(() => localStorage.getItem("untzel.controls.collapsed"))).toBe("true");

    // Code next to Drop, with the controls hidden.
    await codeRoundTrip(page, code);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect(editing).toBeVisible();
    expect(Math.abs((await settledStageHeight(page)) - shown), "the stage returns to its height").toBeLessThan(1);
    await expectAttribution(page);

    // And with the controls shown.
    await codeRoundTrip(page, code);

    // H, outside the editor, from wherever focus is.
    await page.locator("main").focus();
    await page.keyboard.press("h");
    await expect(app).toHaveAttribute("data-collapsed", "true");
    await expect(editing).toBeHidden();
    await page.keyboard.press("h");
    await expect(app).toHaveAttribute("data-collapsed", "false");
    await expect(editing).toBeVisible();
    await page.keyboard.press("h");
    await expect(app).toHaveAttribute("data-collapsed", "true");
    await page.waitForTimeout(600);

    // Four whole slices: two seconds of music across every toggle. The gestures above can
    // take less on a quiet machine, so the measurement waits for them.
    const sound = await stopRms(page, 4);
    expect(sound.slices, "RMS slices sampled").toBeGreaterThan(3);
    expect(sound.states).toEqual(["running"]);
    expectSoundThroughout(sound, "while toggling");
    await expect(page.locator(".ui-transport").getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-pressed", "true");

    // The preference survives a reload: the next play opens with the controls hidden.
    await page.reload();
    await startEngine(page);
    await expect(app).toHaveAttribute("data-collapsed", "true");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(editing).toBeHidden();
    await expectAttribution(page);
    await toggle.click();
    await expect(editing).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("the collapse animates 200 ms and is instant with reduced motion", async ({ browser }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const context = await browser.newContext({ viewport: VIEWPORTS[390], reducedMotion });
    const page = await context.newPage();
    await page.goto("./?sim=1&screen=B&data=wireframe&still=1");
    const toggle = page.locator(".ui-transport__toggle");
    await toggle.waitFor();
    // Click and read in one task: the shell keeps data-transition for 260 ms only, and a
    // read in a later round trip missed it under load (0s instead of 0.2s).
    const durations = await toggle.evaluate((node) => {
      (node as HTMLElement).click();
      return [".ui-stage", ".ui-transport"].map((selector) => getComputedStyle(document.querySelector(selector) as Element).transitionDuration);
    });
    expect(durations, reducedMotion).toEqual(reducedMotion === "reduce" ? ["0s", "0s"] : ["0.2s", "0.2s"]);
    // Nothing waits for the animation: the transport is usable at once.
    await expect(page.locator(".ui-transport").getByRole("button", { name: "Drop", exact: true })).toBeVisible();
    await context.close();
  }
});
