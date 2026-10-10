// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// With 'loop 2' over a 4-bar kick the transport restarts the pattern
// every pass, so bars 3 and 4 never sound. Track detail dims their thumbnails, names them
// "not in the loop" and says "Loop plays bars 1–2 only"; looking changes no text.

import { expect, test, type Page } from "@playwright/test";
import { barsOf, lineOf, startSession } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

const NEXT_BAR_MS = 4_000;

async function chooseLength(page: Page, chip: string, bars: string): Promise<void> {
  await page.getByRole("button", { name: chip }).click();
  const picker = page.getByRole("dialog", { name: /length/i });
  await picker.getByRole("button", { name: bars, exact: true }).click();
  await expect(picker).toBeHidden();
}

for (const width of [390, 1440] as const) {
  test(`track detail says which bars a shorter loop plays at ${width}`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    if (width < 700) await page.getByRole("button", { name: "Adjust kick", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").first().click();
    const detail = page.locator("#ui-detail");
    await expect(detail).toBeVisible();
    // The pattern first: choosing 4 bars grows a shorter written loop in the same edit.
    await chooseLength(page, "Pattern length 1 bar", "4 bars");
    const reach = detail.locator(".ui-detail__reach");
    await expect(reach).toBeHidden();
    if (width < 700) await page.keyboard.press("Escape");
    await chooseLength(page, "Loop length 4 bars", "2 bars");
    expect(await lineOf(page, "loop ")).toBe("loop 2");
    if (width < 700) await page.getByRole("button", { name: "Adjust kick", exact: true }).click();
    const before = await barsOf(page, "kick");
    expect(before).toHaveLength(4);
    const thumbs = detail.getByRole("group", { name: "Bars of kick" });
    // On the next bar the loop sounds 2 bars long.
    await expect(reach).toHaveText("Loop plays bars 1–2 only", { timeout: NEXT_BAR_MS });
    await expect(thumbs.locator('[data-audible="false"]')).toHaveCount(2);
    await expect(thumbs.getByRole("button", { name: "Bar 3, not in the loop" })).toBeVisible();
    await expect(thumbs.getByRole("button", { name: "Bar 2", exact: true })).toHaveAttribute("data-audible", "true");
    // Editing bar 3 is still allowed; it is just said not to sound.
    await thumbs.getByRole("button", { name: "Bar 3, not in the loop" }).click();
    await expect(detail.locator(".ui-detail__editing")).toHaveText("Editing bar 3 of 4");
    await expect(thumbs.locator('[aria-current="true"]')).toHaveAttribute("data-audible", "true", { timeout: NEXT_BAR_MS });
    expect(await barsOf(page, "kick"), "looking changes no text").toEqual(before);
    await screenshot(page, "loop-reach", width);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
