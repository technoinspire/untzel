// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A session with no sections (the song block deleted, or ?stress) once voided the whole
// grid template: repeat(0, …) is invalid CSS, so the cells of every row fell into the
// wrong columns. The table has no section columns at all (the Song
// view edits parts); it must keep its columns, and the Song tab must say how to start.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { startSession } from "../../support/session-support";
import { VIEWPORTS, collectErrors, screenshot, sizedScreenshot } from "../../../../support/support";

const TRACKS = 6;

async function startWithoutSections(page: Page): Promise<void> {
  // The stress session has no song block (tools/sim/src/stress.ts).
  await page.goto(`./?stress=${TRACKS}`);
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
}

/** Left edge of each listed cell, per row, plus whether neighbours overlap. */
async function columns(rows: Locator, selectors: readonly string[]): Promise<{ lefts: number[][]; overlaps: string[] }> {
  return rows.evaluateAll((nodes, list) => {
    const overlaps: string[] = [];
    const lefts = nodes.map((row, index) => {
      const rects = list.map((selector) => row.querySelector(selector)?.getBoundingClientRect() ?? null);
      rects.forEach((rect, at) => {
        const next = rects[at + 1];
        if (rect === null) overlaps.push(`row ${index}: no ${list[at]}`);
        else if (next !== undefined && next !== null && rect.right > next.left + 0.5) {
          overlaps.push(`row ${index}: ${list[at]} overlaps ${list[at + 1]}`);
        }
      });
      return rects.map((rect) => Math.round(rect?.left ?? -1));
    });
    return { lefts, overlaps };
  }, selectors);
}

test("the desktop track table keeps its columns with no sections at 1440", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startWithoutSections(page);
  const table = page.locator(".ui-tracktable .ui-table");
  await expect(table.locator(".ui-table__head .ui-table__th")).toHaveText(["#", "Track", "pattern", "M", "S", "tone"]);
  const rows = table.locator(".ui-table__body .ui-table__row");
  await expect(rows).toHaveCount(TRACKS);
  const { lefts, overlaps } = await columns(rows, [".ui-table__name", ".ui-table__pattern", ".ui-square", ".ui-table__tone"]);
  expect(overlaps).toEqual([]);
  for (const row of lefts) expect(row, "every row has the columns of the first").toEqual(lefts[0]);
  // The header's M column sits over the rows' M buttons.
  const headerM = await page.locator(".ui-table__head .ui-table__th--center").first().boundingBox();
  const rowM = await rows.first().locator(".ui-square").first().boundingBox();
  expect(Math.abs((headerM?.x ?? 0) + (headerM?.width ?? 0) / 2 - ((rowM?.x ?? 0) + (rowM?.width ?? 0) / 2))).toBeLessThan(14);
  await screenshot(page, "no-sections", 1440);
  expect(errors).toEqual([]);
});

/** Px from the miniature's right edge to the M button of the first row. */
async function patternToMuteGap(page: Page): Promise<number> {
  const row = page.locator(".ui-tracktable .ui-table__body .ui-table__row").first();
  const mini = await row.locator(".ui-table__mini").boundingBox();
  const mute = await row.locator(".ui-square").first().boundingBox();
  return Math.round((mute?.x ?? 0) - ((mini?.x ?? 0) + (mini?.width ?? 0)));
}

// With the section columns gone, a spacer pushed M, S and tone to the
// right edge and left ~730 px of dead gap at 1440 with the panel closed.
test("M, S and tone sit right after the pattern at 1440, panel open or closed, loop and song", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startSession(page);
  const GAP_PX = 80;
  expect(await patternToMuteGap(page), "loop, panel closed").toBeLessThan(GAP_PX);
  await screenshot(page, "table-loop", 1440);
  await page.locator(".ui-tracktable .ui-table__name").first().click();
  await expect(page.locator("#ui-detail")).toBeVisible();
  expect(await patternToMuteGap(page), "loop, panel open").toBeLessThan(GAP_PX);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ui-detail")).toBeHidden();
  await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
  const parts = page.getByRole("list", { name: "Parts of the song" });
  await expect(parts).toBeVisible({ timeout: 10_000 });
  expect(await patternToMuteGap(page), "song, panel closed").toBeLessThan(GAP_PX);
  await screenshot(page, "table-song", 1440);
  await parts.getByRole("button").first().click();
  await expect(page.locator("#ui-part")).toBeVisible();
  expect(await patternToMuteGap(page), "song, panel open").toBeLessThan(GAP_PX);
  expect(errors).toEqual([]);
});

test("the Song tab with no parts offers to add the first one at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startWithoutSections(page);
  await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
  const song = page.locator(".ui-song");
  await expect(song.locator(".ui-song__note")).toHaveText(/No parts yet/);
  await expect(song.getByRole("button", { name: "Add part from what is playing" })).toBeVisible();
  await expect(song.locator(".ui-song__list")).toBeHidden();
  expect(errors).toEqual([]);
});
// The tone set by a written parameter says "Set by open". In its 64 px cell the
// sentence ran past the table's edge: the Code panel cut it to "Set" at 1280, and when the
// table scrolled it sat at the sticky head's height, outside it.
interface HintGeometry {
  readonly hint: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly table: { readonly left: number; readonly right: number };
  readonly scrollerRight: number;
  /** Right edge of the first six characters ("Set by"), drawn or cut by the ellipsis. */
  readonly setByRight: number;
  readonly text: string;
  readonly title: string | null;
}
function hintGeometry(page: Page, track: string): Promise<HintGeometry> {
  return page.evaluate((name) => {
    const row = [...document.querySelectorAll(".ui-tracktable .ui-table__body .ui-table__row")].find((node) => node.querySelector(".ui-table__track")?.textContent === name);
    const hint = row?.querySelector(".ui-table__set-by");
    const table = document.querySelector(".ui-tracktable .ui-table")?.getBoundingClientRect();
    const scroller = document.querySelector(".ui-table__scroller")?.getBoundingClientRect();
    const text = hint?.firstChild;
    if (hint === undefined || hint === null || table === undefined || scroller === undefined || text === null || text === undefined) throw new Error(`no hint on ${name}`);
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    const box = hint.getBoundingClientRect();
    return {
      hint: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      table: { left: table.left, right: table.right },
      scrollerRight: scroller.right,
      setByRight: range.getBoundingClientRect().right,
      text: hint.textContent ?? "",
      title: hint.getAttribute("title"),
    };
  }, track);
}
for (const size of [{ width: 1280, height: 720, code: true }, { width: 1440, height: 900, code: false }] as const) {
  test(`"Set by open" stays inside the table and under the sticky head at ${size.width}${size.code ? " with Code open" : ""}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("./");
    await page.getByRole("combobox", { name: "Style", exact: true }).selectOption("afro-house");
    await page.getByRole("button", { name: /^Red Earth\b/ }).click();
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    if (size.code) {
      await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
      await expect(page.locator("#ui-code .cm-content")).toBeVisible();
    }
    const row = page.locator(".ui-tracktable .ui-table__row", { has: page.locator(".ui-table__track", { hasText: /^ohat$/ }) });
    await expect(row.locator(".ui-table__set-by")).toHaveText("Set by open");
    const edge = 0.5;
    const placed = await hintGeometry(page, "ohat");
    expect(placed.title, "the whole sentence in the title").toBe("Set by open");
    expect(placed.hint.left, "the hint starts inside the table").toBeGreaterThanOrEqual(placed.table.left - edge);
    expect(placed.hint.right, "the hint ends at the table's edge").toBeLessThanOrEqual(placed.table.right + edge);
    expect(placed.table.right, "the table fits its scroller").toBeLessThanOrEqual(placed.scrollerRight + edge);
    expect(placed.setByRight, "'Set by' is drawn whole").toBeLessThanOrEqual(placed.hint.right + edge);
    await sizedScreenshot(page, `table-set-by-${size.width}${size.code ? "-code" : ""}`);
    // Half of the row under the head: the head paints over the hint.
    const covered = await page.evaluate(() => {
      const row = [...document.querySelectorAll(".ui-tracktable .ui-table__body .ui-table__row")].find((node) => node.querySelector(".ui-table__track")?.textContent === "ohat");
      const hint = row?.querySelector(".ui-table__set-by");
      const head = document.querySelector(".ui-table > [role='rowgroup']:first-child");
      const scroller = document.querySelector(".ui-table__scroller");
      if (!hint || !head || !scroller) throw new Error("no table");
      const before = hint.getBoundingClientRect();
      const headBox = head.getBoundingClientRect();
      scroller.scrollTop += before.top + before.height / 2 - (headBox.top + headBox.height / 2);
      const box = hint.getBoundingClientRect();
      const x = box.left + Math.min(10, box.width / 2);
      const y = (Math.max(box.top, headBox.top) + Math.min(box.bottom, headBox.bottom)) / 2;
      const top = document.elementFromPoint(x, y);
      return { underHead: box.top < headBox.bottom && box.bottom > headBox.top, isHead: top !== null && head.contains(top), isHint: top !== null && hint.contains(top) };
    });
    expect(covered.underHead, "the row reaches under the head").toBe(true);
    expect(covered.isHint, "the hint never paints over the head").toBe(false);
    expect(covered.isHead, "the head is on top").toBe(true);
    expect(errors).toEqual([]);
  });
}
