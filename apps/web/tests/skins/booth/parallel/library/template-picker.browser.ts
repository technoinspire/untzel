// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The template picker of the waiting stage. A Style list in alphabetical order with the
// number of projects of each; the cards read the name, tempo and
// key from the analyzed program; House → Disco Lights plays at 118 BPM and Psytrance →
// Full Moon at 145; the keyboard moves through the list; the style and the project are
// remembered; 44 px targets, one line at any number of styles and never over the play
// button. Then the pressed Mute and Solo border.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { applyText, edited, linkFragment, startEngine } from "../../support/share-support";
import { VIEWPORTS, collectErrors, expectUnobstructed, screenshot, sizedScreenshot } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  session(): { readonly source: string };
}

const FLARE = "rgb(246, 93, 0)";
const STYLES = [
  "Acid techno · 1 project", "Afro house · 1 project", "Amapiano · 1 project", "Deep house · 1 project", "Downtempo · 1 project", "Hip hop · 1 project",
  "House · 3 projects", "Indie dance · 1 project", "Melodic techno · 3 projects", "Psytrance · 1 project", "Tech house · 1 project", "Trance · 1 project",
];

const styleList = (page: Page): Locator => page.getByRole("combobox", { name: "Style", exact: true });
const openStyle = async (page: Page, id: string): Promise<void> => {
  await styleList(page).selectOption(id);
};
const panel = (page: Page): Locator => page.getByRole("group", { name: "Start from a template" });
const card = (page: Page, name: string): Locator => panel(page).getByRole("button", { name: new RegExp(`^${name}\\b`) });

async function play(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
}

const sourceOf = (page: Page): Promise<string> => page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().source);

/** Height of the Style list and every card, whether any of them meets Tap to play or the line under it, and whether the list fits its line. */
async function layout(page: Page): Promise<{ readonly shortest: number; readonly overlapsPlay: boolean; readonly listFits: boolean }> {
  return page.evaluate(() => {
    const play = [".ui-idle__play", ".ui-idle__sub"].map((selector) => document.querySelector(selector)?.getBoundingClientRect()).filter((box) => box !== undefined);
    const field = document.querySelector(".ui-styles__field")?.getBoundingClientRect();
    const boxes = [...document.querySelectorAll(".ui-styles__select, .ui-styles__card")].map((node) => node.getBoundingClientRect());
    const meets = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      shortest: Math.min(...boxes.map((box) => box.height)),
      overlapsPlay: boxes.some((box) => play.some((target) => meets(box, target))),
      listFits: field !== undefined && field.height < 60 && field.right <= window.innerWidth,
    };
  });
}

async function expectFlareRing(button: Locator): Promise<void> {
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await button.evaluate((node) => getComputedStyle(node).boxShadow)).toContain(FLARE);
}

for (const width of [390, 1440] as const) {
  test(`House → Disco Lights plays at 118 BPM, and Mute and Solo show the pressed border, at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await expect(styleList(page).locator("option")).toHaveText(STYLES);
    await expect(styleList(page)).toHaveValue("melodic-techno");
    // The tempo and key arrive with the engine's code, read from the analyzed program.
    await expect(card(page, "Midnight Bloom")).toHaveText("Midnight Bloom · 124 BPM · a minor");
    await expect(card(page, "Midnight Bloom")).toHaveAttribute("aria-pressed", "true");
    const idle = await layout(page);
    expect(idle.shortest, "44 px targets").toBeGreaterThanOrEqual(44);
    expect(idle.overlapsPlay, "the picker stays clear of the play button").toBe(false);
    expect(idle.listFits, "the Style list takes one line inside the screen").toBe(true);
    await screenshot(page, "template-picker-idle", width);

    await openStyle(page, "house");
    await expect(styleList(page)).toHaveValue("house");
    await expect(panel(page).getByRole("button")).toHaveText(["Sunday Piano · 125 BPM · f major", "Disco Lights · 118 BPM · g major", "Golden Hour · 121 BPM · eb major"]);
    await card(page, "Disco Lights").click();
    await expect(card(page, "Disco Lights")).toHaveAttribute("aria-pressed", "true");
    expect((await layout(page)).overlapsPlay).toBe(false);
    await screenshot(page, "template-picker-house", width);

    await play(page);
    await expect(page.getByRole("region", { name: "Transport" })).toContainText("118 BPM");
    expect(await sourceOf(page)).toMatch(/^\/\/ template: Disco Lights\n/);

    if (width < 700) await page.getByRole("button", { name: "Adjust kick", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: /^kick/ }).click();
    const scope = width < 700 ? page.locator("#ui-detail") : page.locator(".ui-tracktable");
    const mute = width < 700 ? scope.getByRole("button", { name: "Mute", exact: true }) : scope.getByRole("button", { name: "Mute kick", exact: true });
    const solo = width < 700 ? scope.getByRole("button", { name: "Solo", exact: true }) : scope.getByRole("button", { name: "Solo kick", exact: true });
    await mute.click();
    await expectFlareRing(mute);
    await solo.click();
    await expectFlareRing(solo);
    await screenshot(page, "template-picker-mute-solo", width);
    expect(errors).toEqual([]);
  });

  test(`the keyboard moves through the Style list, Full Moon plays at 145 BPM, and the choice is remembered, at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await styleList(page).focus();
    // Typing the first letters of a style jumps to it: the list is alphabetical.
    await page.keyboard.type("Psy");
    await expect(styleList(page)).toHaveValue("psytrance");
    await expect(card(page, "Full Moon")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(card(page, "Full Moon")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(card(page, "Full Moon")).toHaveText("Full Moon · 145 BPM · f# phrygian");
    await expect(card(page, "Full Moon")).toHaveAttribute("aria-pressed", "true");
    await screenshot(page, "template-picker-psytrance", width);

    await page.reload();
    await expect(styleList(page)).toHaveValue("psytrance");
    await expect(card(page, "Full Moon")).toHaveAttribute("aria-pressed", "true");
    await play(page);
    await expect(page.getByRole("region", { name: "Transport" })).toContainText("145 BPM");
    expect(await sourceOf(page)).toMatch(/^\/\/ template: Full Moon\n/);
    expect(errors).toEqual([]);
  });
}

for (const size of [{ width: 1200, height: 800 }, { width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }] as const) {
  test(`the picker stays clear of Tap to play at ${size.width}×${size.height}, in the tallest style`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(size);
    await page.goto("./");
    for (const name of ["melodic-techno", "house"]) {
      await openStyle(page, name);
      await expect(card(page, name === "house" ? "Golden Hour" : "After Hours")).toContainText("BPM");
      const measured = await layout(page);
      expect(measured.shortest, "44 px targets").toBeGreaterThanOrEqual(44);
      expect(measured.listFits, "the Style list takes one line").toBe(true);
      expect(measured.overlapsPlay, `${name}: the picker stays clear of Tap to play`).toBe(false);
    }
    await page.getByRole("button", { name: "Tap to play" }).click({ trial: true });
    expect(errors).toEqual([]);
  });
}
// The waiting screen is one column in flow. With the play button
// and the picker placed absolutely, at 375 × 667 the Blank card (y 204–260) covered the play
// button (170–306), and at 390 × 844 with Remix this and Continue the Blank card met
// "Starts on the next bar". Now the column scrolls when it does not fit.
const PHONES = [{ width: 360, height: 740 }, { width: 375, height: 667 }, { width: 390, height: 844 }] as const;
interface IdleColumn {
  /** "picker box × play box" for every pair that meets. */
  readonly overlaps: readonly string[];
  readonly firstFocusable: string | null;
  /** The legal notice lies inside the visible column. */
  readonly isLegalShown: boolean;
}
function idleColumn(page: Page): Promise<IdleColumn> {
  return page.evaluate(() => {
    const shown = (node: Element): boolean => node.getBoundingClientRect().height > 0;
    const play = [".ui-idle__play", ".ui-idle__sub"].flatMap((selector) => [...document.querySelectorAll(selector)].filter(shown).map((node) => ({ selector, box: node.getBoundingClientRect() })));
    const picker = [".ui-styles__blank", ".ui-idle__templates-label", ".ui-styles__select", ".ui-styles__card", ".ui-idle__hint", ".ui-idle__resume"].flatMap((selector) =>
      [...document.querySelectorAll(selector)].filter(shown).map((node) => ({ selector, box: node.getBoundingClientRect() })),
    );
    const meets = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const overlaps = picker.flatMap((item) => play.filter((target) => meets(item.box, target.box)).map((target) => `${item.selector} × ${target.selector}`));
    const idle = document.querySelector(".ui-idle");
    const focusable = idle === null ? [] : [...idle.querySelectorAll<HTMLElement>("button, select, a[href], input")].filter((node) => !node.hidden && node.checkVisibility());
    const legal = document.querySelector(".ui-idle__legal-text")?.getBoundingClientRect();
    const column = idle?.getBoundingClientRect();
    return {
      overlaps,
      firstFocusable: focusable[0]?.className ?? null,
      isLegalShown: legal !== undefined && column !== undefined && legal.top >= column.top && legal.bottom <= column.bottom + 0.5,
    };
  });
}
async function expectColumn(page: Page, path: string, name: string): Promise<void> {
  await page.goto(path);
  if (path.includes("#")) await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
  await expect(card(page, "Midnight Bloom")).toContainText("BPM");
  const column = await idleColumn(page);
  expect(column.overlaps, `${name}: nothing meets the play button`).toEqual([]);
  expect(column.firstFocusable, `${name}: the play button comes first`).toBe("ui-idle__play");
  expect(column.isLegalShown, `${name}: the copyright notice stays in view`).toBe(true);
  await sizedScreenshot(page, `idle-column-${name}`);
}
test("the waiting screen keeps the picker off the play button on small phones, with a link and with Continue", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  const link = `./${await linkFragment(edited(126))}`;
  for (const size of PHONES) {
    await page.setViewportSize(size);
    await expectColumn(page, "./", `${size.width}x${size.height}`);
    await expectColumn(page, link, `${size.width}x${size.height}-link`);
  }
  // A saved project: Continue joins the column.
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await applyText(page, edited(121));
  await page.waitForTimeout(1_500);
  for (const size of PHONES) {
    await page.setViewportSize(size);
    await page.goto("about:blank");
    await expectColumn(page, "./", `${size.width}x${size.height}-continue`);
    await expect(page.getByRole("button", { name: "Continue Midnight Bloom" })).toBeAttached();
    await page.goto("about:blank");
    await expectColumn(page, link, `${size.width}x${size.height}-link-continue`);
  }
  // The column scrolls to its last control at 375 × 667, clear of the legal band.
  await page.setViewportSize({ width: 375, height: 667 });
  const resume = page.getByRole("button", { name: "Continue Midnight Bloom" });
  await resume.focus();
  await expectUnobstructed(resume);
  await sizedScreenshot(page, "idle-column-375x667-link-continue-scrolled");
  expect(errors).toEqual([]);
});
