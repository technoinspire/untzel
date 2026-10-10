// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The modal layer on the real session. Under 1200 px every sheet but Code,
// opened by keyboard, carries aria-modal, makes the main content and the tab bar inert,
// keeps Tab and Shift+Tab inside it past its last and first stops, and gives the focus
// back to its opener on Esc with nothing left inert. On the desktop the tempo, key and
// length popovers do the same; the side panel and Code on the phone stay non-modal, with
// Play reachable. Tab once left every sheet.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { startEngine } from "../../support/share-support";
import { startSession } from "../../support/session-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

interface ModalCase {
  readonly name: string;
  readonly sheet: string;
  /** The control the keyboard opens the sheet from; Esc gives the focus back to it. */
  readonly opener: (page: Page) => Locator;
  /** Steps before the opener (song mode for the part editor). */
  readonly before?: (page: Page) => Promise<void>;
  /** Steps after Enter on the opener (the menu item that opens the sheet). */
  readonly then?: (page: Page) => Promise<void>;
}

const menuButton = (page: Page): Locator => page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true });
const fromMenu = (item: RegExp) => async (page: Page): Promise<void> => {
  const entry = page.getByRole("menuitem", { name: item });
  await entry.focus();
  await page.keyboard.press("Enter");
};
const visible = (page: Page, selector: string): Locator => page.locator(selector).filter({ visible: true });

async function songMode(page: Page): Promise<void> {
  await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
  await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
  // Song mode enters on the next 4-bar phrase: 7.3 s at 132 BPM.
  await expect(page.getByRole("list", { name: "Parts of the song" })).toBeVisible({ timeout: 10_000 });
}

const PHONE_CASES: readonly ModalCase[] = [
  { name: "track detail", sheet: "#ui-detail", opener: (page) => page.getByRole("button", { name: "Adjust kick", exact: true }) },
  { name: "part editor", sheet: "#ui-part", before: songMode, opener: (page) => page.getByRole("list", { name: "Parts of the song" }).getByRole("button").first() },
  { name: "library", sheet: "#ui-library", opener: (page) => page.locator(".ui-tracks").getByRole("button", { name: "Add track" }) },
  { name: "Export", sheet: "#ui-export", opener: (page) => page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }) },
  { name: "Share", sheet: "#ui-share", opener: menuButton, then: fromMenu(/^Share link/) },
  { name: "Projects", sheet: "#ui-projects", opener: menuButton, then: fromMenu(/^Open project/) },
  { name: "Keyboard shortcuts", sheet: "#ui-shortcuts", opener: menuButton, then: fromMenu(/^Keyboard shortcuts/) },
  { name: "About", sheet: "#ui-about", opener: menuButton, then: fromMenu(/^About and licence/) },
  { name: "Tempo", sheet: "#ui-tempo", opener: (page) => visible(page, ".ui-tempo-key__tempo") },
  { name: "Key", sheet: "#ui-key", opener: (page) => visible(page, ".ui-tempo-key__key") },
  { name: "Length", sheet: "#ui-length", opener: (page) => visible(page, ".ui-transport__length") },
];
const DESKTOP_CASES = PHONE_CASES.filter((modal) => ["Tempo", "Key", "Length"].includes(modal.name));

const isInert = (page: Page, selector: string): Promise<boolean> =>
  page.locator(selector).evaluate((node) => (node as HTMLElement).inert);
const focusIsInside = (sheet: Locator): Promise<boolean> => sheet.evaluate((node) => node.contains(document.activeElement));
/** The stops Tab reaches in the sheet, counted like the guard counts them. */
const stopCount = (sheet: Locator): Promise<number> => sheet.evaluate((node) =>
  [...node.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]")]
    .filter((stop) => stop.tabIndex >= 0 && !(stop as HTMLButtonElement).disabled && stop.closest("[inert]") === null && stop.checkVisibility()).length);

async function expectTabStaysInside(page: Page, sheet: Locator, key: "Tab" | "Shift+Tab"): Promise<void> {
  const stops = await stopCount(sheet);
  expect(stops, "the sheet has stops").toBeGreaterThan(0);
  await sheet.locator(".ui-sheet__title").focus();
  for (let press = 1; press <= stops + 2; press += 1) {
    await page.keyboard.press(key);
    expect(await focusIsInside(sheet), `${key} ${press} of ${stops + 2} stays in the sheet`).toBe(true);
  }
}

async function expectModalCycle(page: Page, modal: ModalCase): Promise<void> {
  await modal.before?.(page);
  const opener = modal.opener(page);
  await opener.focus();
  await page.keyboard.press("Enter");
  await modal.then?.(page);
  const sheet = page.locator(modal.sheet);
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  expect(await isInert(page, "main.ui-main"), "main is inert").toBe(true);
  expect(await isInert(page, "nav.ui-tabs"), "the tab bar is inert").toBe(true);
  expect(await isInert(page, ".ui-topbar"), "the top bar stays live").toBe(false);
  await expectTabStaysInside(page, sheet, "Tab");
  await expectTabStaysInside(page, sheet, "Shift+Tab");
  await sheet.locator(".ui-sheet__title").focus();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden({ timeout: 2_000 });
  await expect(opener, "Esc gives the focus back to the opener").toBeFocused();
  expect(await isInert(page, "main.ui-main"), "nothing stays inert").toBe(false);
  await expect(sheet).not.toHaveAttribute("aria-modal", "true");
}

for (const width of [390, 768, 1024] as const) {
  for (const modal of PHONE_CASES) {
    test(`${modal.name} is modal and holds the Tab at ${width}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize(VIEWPORTS[width]);
      if (modal.before === undefined) await startEngine(page);
      else await startSession(page);
      await expectModalCycle(page, modal);
      expect(errors).toEqual([]);
    });
  }
}

for (const modal of DESKTOP_CASES) {
  test(`the ${modal.name} popover is modal and holds the Tab at 1440`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[1440]);
    await startEngine(page);
    await expectModalCycle(page, modal);
    expect(errors).toEqual([]);
  });
}

/** The centre of Play lands on Play: nothing covers it. */
const playIsReachable = (page: Page): Promise<boolean> => page.locator(".ui-transport__play").evaluate((node) => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return hit !== null && (hit === node || node.contains(hit));
});

test("Code on the phone stays non-modal, with Play reachable", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await page.locator(".ui-transport__code").click();
  await expect(page.locator("#ui-code")).toBeVisible();
  await expect(page.locator("#ui-code")).not.toHaveAttribute("aria-modal", "true");
  expect(await isInert(page, "main.ui-main")).toBe(false);
  expect(await isInert(page, "nav.ui-tabs")).toBe(false);
  expect(await playIsReachable(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("the desktop side panel stays non-modal, with Play reachable", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  for (const open of [
    () => page.locator(".ui-tracktable .ui-table__name").first().click(),
    () => page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }).click(),
    () => page.locator(".ui-transport__code").click(),
  ]) {
    await open();
    await expect(page.locator("aside.ui-panel")).toBeVisible();
    expect(await page.locator("[aria-modal='true']").count(), "no sheet in the panel is modal").toBe(0);
    expect(await isInert(page, "main.ui-main")).toBe(false);
    expect(await playIsReachable(page)).toBe(true);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});
