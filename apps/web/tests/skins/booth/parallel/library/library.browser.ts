// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The library and the sound group of the detail in a real Chrome: search, hear in the
// DSP, add with a sound, pick a sound and
// an effect; everything lands in the text. The search is a combobox over a grid (no
// control nested in another) with a status region for the audition. Captures the library,
// the audition, the sound picker open and the phaser added, at four widths.
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors, screenshot, type ViewportWidth } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  stats(): { readonly instances: readonly { readonly name: string; readonly onsetCount: number }[] } | null;
  session(): { readonly source: string };
}

const hooks = (page: Page) => page.evaluate(() => {
  const t = (globalThis as unknown as { untzelTest?: Hooks }).untzelTest;
  return t === undefined ? null : { stats: t.stats(), source: t.session().source };
});

async function startEngine(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
}

async function openLibrary(page: Page): Promise<void> {
  const add = page.getByRole("button", { name: "Add track" }).filter({ visible: true }).first();
  await add.click();
  await expect(page.locator("#ui-library")).toBeVisible();
}

const previewOnsets = async (page: Page): Promise<number> =>
  (await hooks(page))?.stats?.instances.find((instance) => instance.name === "#preview")?.onsetCount ?? 0;

test("search, hear and add a piano with a sound; the DSP plays the preview and the text gets the line", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await openLibrary(page);
  const library = page.locator("#ui-library");
  const search = library.getByRole("combobox", { name: "Search instruments and sounds" });
  await search.fill("pia");
  // "pia" also finds the electric piano by its description; the piano row comes first.
  await expect(library.locator(".ui-library__row").first()).toContainText("piano");
  // The popup is a grid: rows of cells, each button alone in its cell (no nested controls).
  await expect(library.getByRole("grid", { name: "Instruments" })).toBeVisible();
  expect(await library.locator("[role='option'], [role='listbox']").count()).toBe(0);
  expect(await library.locator("[role='gridcell'] [role='gridcell'], button button").count()).toBe(0);
  await search.press("ArrowDown");
  const active = await search.getAttribute("aria-activedescendant");
  expect(active).not.toBeNull();
  await expect(library.locator(`[id="${active ?? ""}"]`)).toHaveAttribute("role", "gridcell");
  await search.press("ArrowUp");
  await library.getByRole("button", { name: "Preview piano" }).click();
  await expect(library.getByText(/Playing grand in a minor/)).toBeVisible();
  await expect(library.getByRole("status")).toHaveText("Playing piano, grand");
  await expect.poll(() => previewOnsets(page), { timeout: 10_000, message: "preview onsets in the DSP" }).toBeGreaterThan(0);
  await library.getByRole("button", { name: "bright", exact: true }).click();
  await expect(library.getByText(/Playing bright in a minor/)).toBeVisible();
  const before = (await hooks(page))?.source ?? "";
  expect(before).not.toMatch(/^piano:/m);
  await library.getByRole("button", { name: "Add piano · bright" }).last().click();
  await expect(page.locator("#ui-detail")).toBeVisible();
  const source = (await hooks(page))?.source ?? "";
  expect(source).toMatch(/^piano: piano bright /m);
  expect(source).toMatch(/^section groove .* piano \| loop$/m);
  expect(errors).toEqual([]);
});

test("typing in the search writes every letter: no shortcut takes A, a digit or Space", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await openLibrary(page);
  const library = page.locator("#ui-library");
  const search = library.getByRole("combobox", { name: "Search instruments and sounds" });
  const before = (await hooks(page))?.source ?? "";
  // "a" is Add track, "1" the first track and Space play outside a text field.
  await search.pressSequentially("bass 1a");
  await expect(search).toHaveValue("bass 1a");
  await search.fill("");
  await search.pressSequentially("bass");
  await expect(library.getByRole("button", { name: "Add bass", exact: true })).toBeVisible();
  expect((await hooks(page))?.source ?? "", "nothing was added").toBe(before);
  expect(errors).toEqual([]);
});

test("the detail picks a sound and adds and removes an effect, each in the text", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await page.getByRole("button", { name: "Adjust pad", exact: true }).click();
  const detail = page.locator("#ui-detail");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: /^Sound / }).click();
  await detail.getByRole("option", { name: /^bright/ }).click();
  await expect.poll(async () => (await hooks(page))?.source ?? "").toMatch(/^pad: +pad +bright /m);
  await detail.getByRole("button", { name: "Add phaser" }).click();
  await expect.poll(async () => (await hooks(page))?.source ?? "").toMatch(/^pad: .*\| phaser 0\.3/m);
  await detail.getByRole("button", { name: "Remove phaser" }).click();
  await expect.poll(async () => (await hooks(page))?.source ?? "").not.toMatch(/phaser/);
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1024, 1440] as const satisfies readonly ViewportWidth[]) {
  test(`library and sound group captures at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page);
    await openLibrary(page);
    const library = page.locator("#ui-library");
    await screenshot(page, "C1-library", width);
    await library.getByRole("combobox").fill("kalimba");
    await library.getByRole("button", { name: "Preview kalimba" }).click();
    await expect(library.getByText(/Playing tine in a minor/)).toBeVisible();
    await screenshot(page, "C2-audition", width);
    await library.getByRole("combobox").fill("theremin");
    await expect(library.getByText('Nothing called "theremin" yet.')).toBeVisible();
    await screenshot(page, "C3-nothing-found", width);
    await page.keyboard.press("Escape");
    await expect(library).toBeHidden();
    // The phone and tablet open the detail from the tile, the desktop from the track table.
    const tile = page.getByRole("button", { name: "Adjust pad", exact: true }).filter({ visible: true });
    if ((await tile.count()) > 0) await tile.first().click();
    else await page.locator(".ui-tracktable").getByRole("button", { name: /^pad, / }).click();
    const detail = page.locator("#ui-detail");
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: /^Sound / }).click();
    await expect(detail.getByRole("option", { name: /^bright/ })).toBeVisible();
    await screenshot(page, "D1-sound-picker", width);
    await detail.getByRole("button", { name: /^Sound / }).click();
    await detail.getByRole("button", { name: "Add phaser" }).click();
    await expect(detail.getByRole("button", { name: "Remove phaser" })).toBeVisible();
    await detail.getByRole("button", { name: "Remove phaser" }).scrollIntoViewIfNeeded();
    await screenshot(page, "D2-effects", width);
    expect(errors).toEqual([]);
  });
}
