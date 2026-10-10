// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's focus and alert by keyboard, on the real export worker. The focus
// once fell to the body after Render and after Cancel (each
// button hides with the new status), and the failure's alert inside a parent that showed
// with it, which a screen reader may never announce. Now: Render → Cancel, Cancel →
// Render, the finished file → Download, a failure → Try again; the alert is always in the
// page and only its text comes. Renders, so it runs in the "solo" project.
import { expect, test, type Page } from "@playwright/test";
import { exportReady, openExport } from "../support/export-support";
import { startEngine } from "../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";

const button = (page: Page, name: string) => page.locator("#ui-export").getByRole("button", { name, exact: true });

async function press(page: Page, name: string): Promise<void> {
  await button(page, name).focus();
  await page.keyboard.press("Enter");
}

test("Render hands the focus to Cancel and Cancel back to Render, by keyboard, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await openExport(page);
  await press(page, "Render");
  await expect(button(page, "Cancel")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(button(page, "Render")).toBeVisible();
  await expect(button(page, "Render")).toBeFocused();
  expect(errors).toEqual([]);
});

test("the finished story hands the focus to Download, at 1440", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await openExport(page);
  await press(page, "Render");
  await expect(button(page, "Cancel")).toBeFocused();
  await exportReady(page, 90_000);
  await expect(button(page, "Download")).toBeFocused();
  expect(errors).toEqual([]);
});

test("a failure fills the alert that was already there and hands the focus to Try again, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  // No worker: the job fails at once with the generic failure.
  await page.route("**/assets/export.worker-*.js", (route) => route.abort());
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  const sheet = await openExport(page);
  const alert = sheet.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText("");
  expect(await alert.evaluate((node) => node.checkVisibility()), "the empty alert is rendered, not display: none").toBe(true);
  await press(page, "Render");
  await expect(alert).toHaveText("The export failed. The music keeps playing.");
  await expect(button(page, "Try again")).toBeFocused();
  expect(errors.filter((error) => !error.includes("worker error")), "only the forced worker failure").toEqual([]);
});
