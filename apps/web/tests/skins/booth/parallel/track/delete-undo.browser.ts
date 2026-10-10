// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Delete once removed a track at once and the phone had no Undo. Now
// a toast says "ride deleted" with Undo; Undo brings the line back and offers Redo, by
// touch, at 390 and 1440. The music never stops.

import { expect, test } from "@playwright/test";
import { expectSoundThroughout, lineOf, startRms, startSession, stopRms, waitForNextBar } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

for (const width of [390, 1440] as const) {
  test(`Delete offers Undo and then Redo at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    const line = await lineOf(page, "ride:");
    expect(line).not.toBe("");

    if (width < 700) await page.getByRole("button", { name: "Adjust ride", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: /^ride/ }).click();
    await page.locator("#ui-detail").getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => lineOf(page, "ride:")).toBe("");

    const toast = page.locator(".ui-toast");
    await expect(toast).toBeVisible();
    await expect(toast.locator(".ui-toast__message")).toHaveText("ride deleted");
    const undo = toast.getByRole("button", { name: "Undo" });
    const box = await undo.boundingBox();
    expect(box?.height ?? 0, "Undo is a 44 px target").toBeGreaterThanOrEqual(44);
    await screenshot(page, "delete-undo", width);
    await undo.click();
    await expect.poll(() => lineOf(page, "ride:")).toBe(line);
    await expect(toast.locator(".ui-toast__message")).toHaveText("ride is back");
    await toast.getByRole("button", { name: "Redo" }).click();
    await expect.poll(() => lineOf(page, "ride:")).toBe("");
    // Hold until the next bar, so the RMS spans the edits and the bar after them.
    await waitForNextBar(page);
    await toast.getByRole("button", { name: "Dismiss" }).click();
    await expect(toast).toBeHidden();

    const rms = await stopRms(page);
    expectSoundThroughout(rms, "delete and undo");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
  // The deleted track's opener is gone; the keyboard waits next to Undo (it once fell to
  // the main content), and a tap leaves it alone.
  test(`Delete by Enter puts the focus on Undo, and Enter brings the track back, at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    const line = await lineOf(page, "ride:");
    const opener = width < 700
      ? page.getByRole("button", { name: "Adjust ride", exact: true })
      : page.locator(".ui-tracktable .ui-table__name").filter({ hasText: /^ride/ });
    await opener.focus();
    await page.keyboard.press("Enter");
    await page.locator("#ui-detail").getByRole("button", { name: "Delete", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => lineOf(page, "ride:")).toBe("");
    const undo = page.locator(".ui-toast").getByRole("button", { name: "Undo" });
    await expect(undo).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => lineOf(page, "ride:")).toBe(line);
    await expect(page.locator(".ui-toast").getByRole("button", { name: "Redo" })).toBeFocused();
    expect(errors).toEqual([]);
  });
  test(`Delete by a tap leaves the focus off the toast at ${width}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    if (width < 700) await page.getByRole("button", { name: "Adjust ride", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: /^ride/ }).click();
    await page.locator("#ui-detail").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator(".ui-toast")).toBeVisible();
    expect(await page.locator(".ui-toast").evaluate((toast) => toast.contains(document.activeElement))).toBe(false);
  });
}
// At 390 the toast "kick deleted · Undo" (y 696–752) covered
// "Export video or audio…" of the open menu; the menu's list now ends above the toast.
// A language switch while the toast shows rewrites its message and its action.
test("the toast covers no menu item at 390 and follows a language switch", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  await page.getByRole("button", { name: "Adjust ride", exact: true }).click();
  await page.locator("#ui-detail").getByRole("button", { name: "Delete", exact: true }).click();
  const toast = page.locator(".ui-toast");
  await expect(toast.locator(".ui-toast__message")).toHaveText("ride deleted");
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.locator(".ui-sheet--menu");
  await expect(menu).toBeVisible();
  // The sheet rises 24 px as it opens: measure where it rests.
  await menu.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  const covered = await page.evaluate(() => {
    const toastBox = document.querySelector(".ui-toast")?.getBoundingClientRect();
    const body = document.querySelector(".ui-sheet--menu .ui-sheet__body")?.getBoundingClientRect();
    if (toastBox === undefined || body === undefined) throw new Error("no toast or menu");
    return [...document.querySelectorAll(".ui-sheet--menu [role^='menuitem']")].flatMap((item) => {
      const box = item.getBoundingClientRect();
      // The part of the item the list shows: it scrolls inside the sheet's body.
      const top = Math.max(box.top, body.top);
      const bottom = Math.min(box.bottom, body.bottom);
      const meets = top < bottom && top < toastBox.bottom && toastBox.top < bottom && box.left < toastBox.right && toastBox.left < box.right;
      return meets ? [item.textContent?.trim() ?? ""] : [];
    });
  });
  expect(covered, "no menu item under the toast").toEqual([]);
  await screenshot(page, "toast-over-menu", 390);
  const radio = page.getByRole("menuitemradio", { name: "Português" });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await expect(toast.locator(".ui-toast__message")).toHaveText("ride apagada");
  await expect(toast.getByRole("button", { name: "Desfazer" })).toBeVisible();
  // × was named once, at start, and kept "Dismiss" after the switch.
  await expect(toast.getByRole("button", { name: "Dispensar", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
