// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Short desktop windows. With a fixed
// 430 px stage the track table kept 38 px of scroller at 1280×720, and its head scrolled
// away with a 24 px parent, so rows ran under the "Tracks" title. The stage now gives way
// to three whole rows, and the head's rowgroup sticks over the rows.
import { expect, test, type Page } from "@playwright/test";
import { collectErrors, expectAttribution, sizedScreenshot } from "../../../../support/support";
const SIZES = [
  { width: 1200, height: 650 },
  { width: 1280, height: 720 },
  { width: 1366, height: 650 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;
/** From this height up the stage keeps its 430 px and the table keeps its full layout. */
const FULL_STAGE_FROM = 900;
const MIN_WHOLE_ROWS = 3;
const HEAD_PX = 24;
const SCROLLED_PX = 70;
const EDGE = 0.5;
/** Song starts on the next phrase: the 8-bar loop at 124 BPM is 15.5 s. */
const NEXT_PHRASE_MS = 20_000;
interface Geometry {
  readonly wholeRows: number;
  readonly stage: number;
  readonly canvas: number;
  readonly transportTop: number;
  readonly transportBottom: number;
  readonly tableTop: number;
  readonly tableFooterBottom: number;
  readonly footerTop: number;
  readonly footerBottom: number;
  readonly viewport: number;
  /** Rows whose box meets the title or the head while the list is at its top. */
  readonly rowsUnderHead: number;
}
/** The transport's drawn height has reached --transport-block: the stage has its final height. */
async function settle(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const app = document.querySelector<HTMLElement>(".ui-app");
        const transport = document.querySelector<HTMLElement>(".ui-transport");
        return app?.style.getPropertyValue("--transport-block") === `${transport?.offsetHeight ?? -1}px`;
      }),
    )
    .toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(
    ({ head, edge }) => {
      const box = (selector: string): DOMRect => {
        const node = document.querySelector(selector);
        if (node === null) throw new Error(`no ${selector}`);
        return node.getBoundingClientRect();
      };
      const scroller = box(".ui-table__scroller");
      const headBox = box(".ui-table > [role='rowgroup']:first-child");
      const title = box(".ui-tracktable__title");
      const rows = [...document.querySelectorAll(".ui-table__body .ui-table__row")].map((row) => row.getBoundingClientRect());
      const meets = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom - edge && b.top < a.bottom - edge;
      const transport = box(".ui-transport");
      const footer = box(".ui-footer");
      return {
        wholeRows: rows.filter((row) => row.top >= scroller.top + head - edge && row.bottom <= scroller.bottom + edge).length,
        stage: box(".ui-stage").height,
        canvas: document.querySelector<HTMLCanvasElement>("canvas.untzel-stage")?.clientHeight ?? -1,
        transportTop: transport.top,
        transportBottom: transport.bottom,
        tableTop: box(".ui-tracktable").top,
        tableFooterBottom: box(".ui-tracktable__footer").bottom,
        footerTop: footer.top,
        footerBottom: footer.bottom,
        viewport: innerHeight,
        rowsUnderHead: rows.filter((row) => meets(row, headBox) || meets(row, title)).length,
      };
    },
    { head: HEAD_PX, edge: EDGE },
  );
}
/**
 * Scrolled: the head stays at the scroller's top, and where a row passes under the head
 * the topmost element at the title and at the M header is never part of a row.
 */
function scrolledOverlaps(page: Page): Promise<{ headOffset: number; rowsUnderHead: number; paintedOver: string[] }> {
  return page.evaluate((scrolled) => {
    const scroller = document.querySelector<HTMLElement>(".ui-table__scroller");
    const head = document.querySelector<HTMLElement>(".ui-table > [role='rowgroup']:first-child");
    const title = document.querySelector<HTMLElement>(".ui-tracktable__title");
    const columnM = head?.querySelector<HTMLElement>(".ui-table__th--center");
    if (scroller === null || head === null || title === null || columnM === null || columnM === undefined) throw new Error("no track table");
    scroller.scrollTop = scrolled;
    const headBox = head.getBoundingClientRect();
    const rows = [...document.querySelectorAll(".ui-table__body .ui-table__row")];
    const under = rows.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top < headBox.bottom && box.bottom > headBox.top;
    });
    const paintedOver: string[] = [];
    for (const target of [title, columnM]) {
      const box = target.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (top?.closest(".ui-table__row") !== null) paintedOver.push(`${target.textContent ?? ""} covered by a row`);
    }
    const result = { headOffset: headBox.top - scroller.getBoundingClientRect().top, rowsUnderHead: under.length, paintedOver };
    scroller.scrollTop = 0;
    return result;
  }, SCROLLED_PX);
}
async function expectState(page: Page, size: { readonly width: number; readonly height: number }, state: string): Promise<void> {
  await settle(page);
  const label = `${size.width}×${size.height}, ${state}`;
  const at = await geometry(page);
  expect(at.wholeRows, `${label}: whole rows`).toBeGreaterThanOrEqual(MIN_WHOLE_ROWS);
  if (size.height >= FULL_STAGE_FROM) expect(at.stage, `${label}: stage`).toBe(430);
  expect(at.canvas, `${label}: the renderer follows the stage`).toBe(at.stage);
  expect(at.transportTop, `${label}: transport under the stage`).toBeGreaterThanOrEqual(at.stage - EDGE);
  expect(at.transportBottom, `${label}: transport over the table`).toBeLessThanOrEqual(at.tableTop + EDGE);
  expect(at.tableFooterBottom, `${label}: Add track over the footer`).toBeLessThanOrEqual(at.footerTop + EDGE);
  expect(at.footerBottom, `${label}: footer inside the window`).toBeLessThanOrEqual(at.viewport + EDGE);
  expect(at.rowsUnderHead, `${label}: no row meets the head or the title at the top`).toBe(0);
  const scrolled = await scrolledOverlaps(page);
  expect(Math.abs(scrolled.headOffset), `${label}: head stays at the top while scrolled`).toBeLessThanOrEqual(EDGE);
  expect(scrolled.rowsUnderHead, `${label}: a row passes under the head`).toBeGreaterThan(0);
  expect(scrolled.paintedOver, `${label}: rows pass under the head and the title`).toEqual([]);
  await expectAttribution(page);
  await sizedScreenshot(page, `short-desktop-${size.width}x${size.height}-${state}`);
}
for (const size of SIZES) {
  test(`the track table keeps three whole rows under a sticky head at ${size.width}×${size.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(size);
    // The first-touch template: 20 tracks and a song, so the table scrolls in both modes.
    await page.goto("./?template=melodic-techno/midnight-bloom");
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    const transport = page.locator(".ui-transport");
    const code = transport.getByRole("button", { name: "Code", exact: true });
    await expectState(page, size, "loop");
    await code.click();
    await expect(page.locator(".ui-app")).toHaveAttribute("data-code", "shown");
    await expectState(page, size, "loop-code");
    await transport.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
    await expect(page.locator(".ui-app")).toHaveAttribute("data-mode", "song", { timeout: NEXT_PHRASE_MS });
    await expectState(page, size, "song-code");
    await code.click();
    await expect(page.locator(".ui-app")).not.toHaveAttribute("data-code", "shown");
    await expectState(page, size, "song");
    expect(errors).toEqual([]);
  });
}
