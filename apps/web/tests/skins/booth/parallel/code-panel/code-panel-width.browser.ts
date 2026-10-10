// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The Code panel's width on the desktop:
// clamp(480px, 40vw, 720px) by default, a divider between 360 px and 60vw that the
// arrows move 16 px and a drag moves freely, kept like the collapse state, a double
// click back to the default, and long lines that scroll sideways with the cursor in
// view. Below 1200 px the Code sheet has no divider and nothing changes.

import { expect, test, type Page } from "@playwright/test";
import { SAMPLE, openCode } from "../../support/code-panel-support";
import { collectErrors, expectAttribution, screenshot } from "../../../../support/support";

const panelWidth = (page: Page): Promise<number> =>
  page.locator(".ui-panel").evaluate((node) => Math.round(node.getBoundingClientRect().width));

test("Code panel width at 1440: default, keyboard, drag, kept, double click", async ({ page }) => {
  const errors = collectErrors(page);
  await openCode(page, 1440);
  const divider = page.getByRole("separator", { name: "Resize the Code panel" });
  await expect(divider).toBeVisible();
  expect(await panelWidth(page), "clamp(480px, 40vw, 720px) at 1440").toBe(576);
  await expect(divider).toHaveAttribute("aria-valuenow", "576");
  await expect(divider).toHaveAttribute("aria-valuemin", "360");
  await expect(divider).toHaveAttribute("aria-valuemax", "864");
  await screenshot(page, "code-panel-wide", 1440);

  // Keyboard: Left widens by 16, Right narrows; Home and End stop at the bounds.
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await panelWidth(page)).toBe(592);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await panelWidth(page)).toBe(560);
  await expect(divider).toHaveAttribute("aria-valuenow", "560");
  await page.keyboard.press("Home");
  expect(await panelWidth(page)).toBe(360);
  await page.keyboard.press("End");
  expect(await panelWidth(page)).toBe(864);

  // Drag: the panel's left edge follows the pointer.
  const box = await divider.boundingBox();
  expect(box).not.toBeNull();
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, y);
  await page.mouse.down();
  await page.mouse.move(1440 - 700, y, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await panelWidth(page)) - 700), "dragged to 700").toBeLessThanOrEqual(1);

  // Kept for the next visit, like the collapse state.
  await openCode(page, 1440);
  expect(Math.abs((await panelWidth(page)) - 700), "kept after a reload").toBeLessThanOrEqual(1);

  // Double click: back to the default.
  await page.getByRole("separator", { name: "Resize the Code panel" }).dblclick();
  expect(await panelWidth(page)).toBe(576);

  // Long lines scroll sideways inside the editor; the cursor at a line's end stays in view.
  const scroller = page.locator("#ui-code .cm-scroller");
  const overflow = await scroller.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(overflow, "a long line scrolls instead of wrapping").toBeGreaterThan(0);
  const longest = SAMPLE.split("\n").reduce((best, line, index, lines) => (line.length > (lines[best] ?? "").length ? index : best), 0);
  await page.locator("#ui-code .cm-line").nth(longest).click();
  await page.keyboard.press("End");
  await page.getByRole("separator", { name: "Resize the Code panel" }).focus();
  await page.keyboard.press("Home");
  // The editor is not focused now (no drawn cursor): the end of the line it sat on
  // must be inside the scroller.
  await expect
    .poll(
      () =>
        page.evaluate((index) => {
          const line = document.querySelectorAll("#ui-code .cm-line")[index];
          const view = document.querySelector("#ui-code .cm-scroller")?.getBoundingClientRect();
          if (line === undefined || view === undefined) return false;
          // The last character of the line, from its last text node.
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
          let last: Text | null = null;
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) if ((node.textContent ?? "") !== "") last = node as Text;
          if (last === null) return false;
          const range = document.createRange();
          range.setStart(last, last.length - 1);
          range.setEnd(last, last.length);
          const end = range.getBoundingClientRect();
          return end.left >= view.left && end.right <= view.right + 1;
        }, longest),
      { message: "the place being edited stays in view after the panel narrows" },
    )
    .toBe(true);
  await screenshot(page, "code-panel-narrow", 1440);

  await expectAttribution(page);
  expect(errors).toEqual([]);
});

test("Code sheet at 1024: no divider, the sheet as before", async ({ page }) => {
  const errors = collectErrors(page);
  await openCode(page, 1024);
  await expect(page.getByRole("separator", { name: "Resize the Code panel" })).toBeHidden();
  await screenshot(page, "code-panel-wide", 1024);
  await expectAttribution(page);
  expect(errors).toEqual([]);
});
