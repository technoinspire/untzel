// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project menu on the real shell: a WAI-ARIA menu button that
// opens a sheet under 1200 px and a popover from 1200 px, walked by the arrows in one
// order, closed by Esc with the focus back on the button; the switches keep it open and
// redraw it; the attribution stays visible; the music never stops.
import { expect, test, type Page } from "@playwright/test";
import { session, startEngine } from "../../support/share-support";
import { collectErrors, expectAttribution } from "../../../../support/support";

const menuButton = (page: Page) => page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true });
const focusedCommand = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("data-command") ?? null);

for (const viewport of [{ width: 390, height: 844 }, { width: 1199, height: 800 }, { width: 1440, height: 900 }]) {
  const isPopover = viewport.width >= 1200;
  test(`the menu opens, walks and closes by keyboard and touch at ${viewport.width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await startEngine(page);
    const button = menuButton(page);
    await expect(button).toHaveAttribute("aria-haspopup", "menu");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(isPopover ? ".ui-menu-popover" : "#ui-menu-sheet")).toBeVisible();
    await expect(page.locator(isPopover ? "#ui-menu-sheet" : ".ui-menu-popover")).toBeHidden();
    await expect.poll(() => focusedCommand(page)).toBe("new-project");
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => focusedCommand(page)).toBe("about");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => focusedCommand(page)).toBe("new-project");
    await page.keyboard.press("End");
    await expect.poll(() => focusedCommand(page)).toBe("about");
    await page.keyboard.press("Home");
    await page.keyboard.press("d");
    await expect.poll(() => focusedCommand(page)).toBe("duplicate");
    await expectAttribution(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    // Touch or click: opens on the first item too, and choosing a command closes it.
    await button.click();
    await expect.poll(() => focusedCommand(page)).toBe("new-project");
    await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();
    await expect(page.locator("#ui-shortcuts")).toBeVisible();
    await expect(menu).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    expect((await session(page)).playing).toBe(true);
    expect(errors).toEqual([]);
  });
}

// The menu button pattern: Tab closes the menu and the page's order goes on from the Menu
// button. The focus once landed on Tracks (390) or the
// wordmark (1440), the slot's next neighbour in the DOM.
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`Tab and Shift+Tab leave the menu from the Menu button at ${viewport.width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await startEngine(page);
    const button = menuButton(page);
    const active = () => page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120) ?? "");
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    const beforeMenu = await active();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedCommand(page)).toBe("new-project");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".ui-transport__play")).toBeFocused();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedCommand(page)).toBe("new-project");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("menu")).toBeHidden();
    expect(await active(), "Shift+Tab goes to what comes before Menu").toBe(beforeMenu);
    expect(errors).toEqual([]);
  });
}
test("the switches keep the menu open and redraw it; Preview sounds is the detail's own", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await menuButton(page).click();
  const motion = page.getByRole("menuitemcheckbox", { name: /Reduced motion/ });
  await motion.focus();
  await page.keyboard.press("Enter");
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await expect(motion).toContainText("On");
  await expect(motion).toContainText("Set on this device");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(motion).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.keyboard.press("Enter");
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await expect(motion).toContainText("Follows your system");
  const preview = page.getByRole("menuitemcheckbox", { name: /Preview sounds/ });
  await preview.click();
  await expect(preview).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");
  await page.locator(".ui-tracktable .ui-table__name").first().click();
  await expect(page.locator("#ui-detail").getByRole("switch", { name: "Preview sounds" })).toHaveAttribute("aria-checked", "false");
});

test("with nothing saved, the system asking for reduced motion turns the switch On, still following it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await menuButton(page).click();
  const motion = page.getByRole("menuitemcheckbox", { name: /Reduced motion/ });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await expect(motion).toContainText("Follows your system");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("waiting with no project: three Project items, no Share and export, the same order of groups", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Untzel" })).toHaveCount(1);
  await menuButton(page).click();
  // The menu loads after the first paint (lazy-menu.ts): a click this early waits for it.
  await expect(page.getByRole("menu")).toBeVisible();
  const commands = await page.getByRole("menu").locator("[data-command]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-command")));
  expect(commands).toEqual(["new-project", "open-project", "open-file", "language-pt-BR", "language-en", "preview-sounds", "reduced-motion", "documentation", "keyboard-shortcuts", "about"]);
  const columns = await page.locator(".ui-menu__column").evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".ui-menu__group-label").length));
  expect(columns).toEqual([2, 1]);
  // The Reduced motion switch works on the waiting screen too, without closing the menu.
  const motion = page.getByRole("menuitemcheckbox", { name: /Reduced motion/ });
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("menu")).toBeVisible();
});

test("crossing 1200 px with the menu open closes it and gives the focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startEngine(page);
  await menuButton(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
  // Crossing 1280 px only reorders the Share sheet: the menu stays open.
  await page.setViewportSize({ width: 1240, height: 900 });
  await page.waitForTimeout(200);
  await expect(page.getByRole("menu")).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(menuButton(page)).toBeFocused();
});

test("every target of the menu is at least 44 px and the inert items say why", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startEngine(page);
  await menuButton(page).click();
  for (const command of ["share-link", "export-media"]) {
    await expect(page.locator(`[data-command="${command}"]`)).not.toHaveAttribute("aria-disabled", "true");
  }
  const heights = await page.getByRole("menu").locator("[data-command]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
});
