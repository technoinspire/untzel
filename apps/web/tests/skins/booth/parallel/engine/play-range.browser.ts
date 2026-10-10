// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range on the real session at 390 and 1440: the
// loop's range by the keyboard on the handles and by two taps, the song's range by a
// part's bracket and To here, a part's Play repeating it alone, Cycle, and the export
// sheet's Selected range. Every change enters on the next bar; the music never stops;
// the text never changes; the attribution stays.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectSoundThroughout, sourceOf, startRms, startSession, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

/** Song mode enters on the next 4-bar phrase: 7.3 s at 132 BPM, plus margin. */
const NEXT_PHRASE_MS = 10_000;
/** Two bars at 132 BPM, plus margin: the change is on the next unscheduled bar. */
const TWO_BARS_MS = 5_000;

async function chooseLoopLength(page: Page, bars: string): Promise<void> {
  await chooseLength(page, /^Loop length/, bars);
}

async function chooseLength(page: Page, chip: string | RegExp, bars: string): Promise<void> {
  await page.getByRole("button", { name: chip }).click();
  const picker = page.getByRole("dialog", { name: /length/i });
  await picker.getByRole("button", { name: bars, exact: true }).click();
  await expect(picker).toBeHidden();
}

async function pressOn(handle: Locator, key: string, times: number): Promise<void> {
  await handle.focus();
  for (let index = 0; index < times; index += 1) await handle.press(key);
}

/** The bars the position line names over `ms`, sampled every 200 ms. */
async function barsHeard(page: Page, ms: number): Promise<number[]> {
  const position = page.locator(".ui-transport__position");
  const heard: number[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += 200) {
    const match = / bar (\d+)(?: of \d+)?$/.exec((await position.textContent()) ?? "");
    if (match?.[1] !== undefined) heard.push(Number(match[1]));
    await page.waitForTimeout(200);
  }
  return heard;
}

/** Taps the middle of a bar of the ruler (1-based). */
async function tapBar(ruler: Locator, bar: number, bars: number): Promise<void> {
  const track = ruler.locator(".ui-range-ruler__track");
  const box = await track.boundingBox();
  if (box === null) throw new Error("no ruler");
  await track.click({ position: { x: ((bar - 0.5) / bars) * box.width, y: box.height - 3 } });
}

/** No part row cuts its meta ("16 bars · 5 tracks · playing") with an ellipsis. */
async function expectMetaWhole(page: Page): Promise<void> {
  const cut = await page.locator(".ui-song__list .ui-partrow__meta").evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent));
  expect(cut, "part rows with a cut meta").toEqual([]);
}

for (const width of [390, 1440] as const) {
  test(`play range at ${width}: loop, song, a part's Play and the export sheet; the music never stops`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    const transport = page.locator(".ui-transport");
    const ruler = transport.getByRole("group", { name: "Play range" });
    const start = ruler.getByRole("slider", { name: "Range start" });
    const end = ruler.getByRole("slider", { name: "Range end" });
    const status = page.locator(".ui-app > [role='status']");
    await chooseLoopLength(page, "8 bars");
    await expect(transport.locator(".ui-range-ruler__cell")).toHaveCount(8, { timeout: TWO_BARS_MS });
    await expect(transport.getByText("Whole loop · drag a handle or tap two bars")).toBeVisible();
    await expect(start).toHaveAttribute("aria-valuetext", "Start, bar 1 of 8, whole loop");
    const textBefore = await sourceOf(page);

    // Loop: the keyboard on the handles, one bar per arrow. The slider says each value;
    // the status region says nothing per key.
    await expect(status).toHaveText(/^Loop of 8 bars/);
    const statusBefore = await status.textContent();
    await pressOn(start, "ArrowRight", 2);
    await pressOn(end, "ArrowLeft", 2);
    await expect(start).toHaveAttribute("aria-valuetext", "Start, bar 3 of 8");
    await expect(end).toHaveAttribute("aria-valuetext", "End, bar 6 of 8");
    await expect(end).toHaveAttribute("aria-valuenow", "6");
    await expect(transport.locator(".ui-range-row__label")).toHaveText("Range: bars 3–6");
    expect(await status.textContent(), "no announcement per key").toBe(statusBefore);
    await page.waitForTimeout(TWO_BARS_MS);
    const heard = await barsHeard(page, 6_000);
    expect(heard.length, "bars named while sampling").toBeGreaterThan(10);
    expect(new Set(heard), "only bars 3 to 6 play").toEqual(new Set([3, 4, 5, 6]));
    await expect(transport.locator(".ui-transport__position")).toHaveText(/^Loop · bars 3–6 of 8 · bar [3-6]$/);
    await screenshot(page, "range-loop", width);

    // A 1-bar range grows to the left by dragging: the first 6 px pick the Start handle
    // when the two lines are under 12 px apart and their targets overlap.
    await pressOn(start, "End", 1);
    await expect(start).toHaveAttribute("aria-valuetext", "Start, bar 6 of 8");
    const lines = await start.boundingBox();
    if (lines === null) throw new Error("no handle");
    const grabX = lines.x + lines.width / 2;
    const barWidth = ((await ruler.locator(".ui-range-ruler__track").boundingBox())?.width ?? 0) / 8;
    await page.mouse.move(grabX, lines.y + lines.height / 2);
    await page.mouse.down();
    await page.mouse.move(grabX - 8, lines.y + lines.height / 2, { steps: 2 });
    await page.mouse.move(grabX - 1.5 * barWidth, lines.y + lines.height / 2, { steps: 6 });
    await expect(ruler.locator(".ui-range-ruler__value")).toHaveText("Start · bar 4");
    if (width === 1440) await screenshot(page, "range-loop-drag", width);
    await page.mouse.up();
    await expect(transport.locator(".ui-range-row__label")).toHaveText("Range: bars 4–6");
    await expect(status).toHaveText("Range bars 4 to 6, from the next bar.");
    await expect(ruler.locator(".ui-range-ruler__value")).toBeHidden();

    // On the desktop, the ruler's key under the chip.
    if (width === 1440) await expect(transport.getByText("Band = range · white line = playing now · orange outline = the bar you edit")).toBeVisible();

    // Two taps: bar 2, then bar 4 (the first one waits with a dashed outline and Cancel).
    await tapBar(ruler, 2, 8);
    await expect(transport.locator(".ui-range-row__hint")).toHaveText("From bar 2: tap the end bar");
    await expect(transport.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(transport.getByRole("button", { name: "Play from here" })).toBeVisible();
    await expect(transport.locator(".ui-range-ruler__pending")).toBeVisible();
    await screenshot(page, "range-loop-pending", width);
    await tapBar(ruler, 4, 8);
    await expect(transport.locator(".ui-range-row__label")).toHaveText("Range: bars 2–4");
    await transport.getByRole("button", { name: "Clear range" }).click();
    await expect(transport.getByText("Whole loop · drag a handle or tap two bars")).toBeVisible();
    await expect(start).toBeFocused();

    // Song: a part's bracket, To here, a part's Play.
    if (width < 700) {
      await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
      await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
    } else {
      await transport.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
    }
    const parts = page.getByRole("list", { name: "Parts of the song" });
    await expect(parts).toBeVisible({ timeout: NEXT_PHRASE_MS });
    await expect(page.locator(".ui-song__list .ui-partrow[data-state='playing']")).toHaveCount(1, { timeout: NEXT_PHRASE_MS });
    await expectMetaWhole(page);
    await expect(transport.locator(".ui-range-ruler__cell")).toHaveCount(6);
    await parts.getByRole("button", { name: "Set range to build" }).first().click();
    await parts.getByRole("button", { name: "To here: extend the range to drop" }).first().click();
    await expect(transport.locator(".ui-range-row__label")).toHaveText("Range: bars 9–28");
    await expect(page.locator(".ui-song__list .ui-partrow").nth(1)).toHaveAccessibleName(/Start · bar 9/);
    await expect(transport.getByRole("switch", { name: "Cycle" })).toHaveAttribute("aria-checked", "true");
    await expect(start).toHaveAttribute("aria-valuetext", "Start, bar 9 of 56, build");
    await expect.poll(async () => (await barsHeard(page, 400)).every((bar) => bar >= 9 && bar <= 28), { timeout: TWO_BARS_MS }).toBe(true);
    await expect(transport.locator(".ui-transport__position")).toHaveText(/^Song · build → drop · bars 9–28 · bar \d+ of 56$/);
    // The rows say their whole meta at every width.
    await screenshot(page, "range-song", width);
    await expectMetaWhole(page);

    const playDrop = parts.getByRole("button", { name: "Play drop only" }).first();
    await expect(playDrop).toHaveAttribute("aria-pressed", "false");
    await playDrop.click();
    await expect(playDrop).toHaveAttribute("aria-pressed", "true");
    await expect(status).toHaveText("Only drop plays, from the next bar.");
    await expect(transport.locator(".ui-range-row__label")).toHaveText("Range: bars 13–28");
    await expect.poll(async () => (await barsHeard(page, 400)).every((bar) => bar >= 13 && bar <= 28), { timeout: TWO_BARS_MS }).toBe(true);
    await expect(page.locator(".ui-song__list .ui-partrow[data-state='playing'] .ui-partrow__meta")).toHaveText(/· playing$/);
    await expectMetaWhole(page);
    await screenshot(page, "range-song-part-play", width);

    // The export sheet follows: Selected range is chosen and says the bars.
    await page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }).click();
    const sheet = page.locator("#ui-export");
    await sheet.getByRole("button", { name: /^Video/ }).click();
    await expect(sheet.getByRole("button", { name: "Selected range" })).toHaveAttribute("aria-pressed", "true");
    // The words the transport says.
    await expect(sheet.locator(".ui-export__selected")).toHaveText("Bars 13–28 · drop");
    await expect(sheet.locator(".ui-export__readout")).toHaveText(/ · bar 13\.1 → .* · bar 29\.1$/);
    await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 13 · 16 bars");
    await expect(sheet.locator(".ui-export__status")).toHaveText("0:29 + 2 s · not rendered");
    await screenshot(page, "range-export", width);
    await sheet.getByRole("button", { name: "Song", exact: true }).click();
    await expect(sheet.getByRole("button", { name: "Selected range" })).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");

    // The part's Play again clears the range; the text never changed.
    await playDrop.click();
    await expect(status).toHaveText("Range cleared. The whole song plays from the next bar.");
    expect(await sourceOf(page), "the range never edits the text").toBe(textBefore);

    // The bar in edit outlined on the loop's ruler, in every loop bar that plays it:
    // bar 2 of a 4-bar kick under the 8-bar loop is ruler bars 2 and 6.
    if (width === 1440) {
      await transport.locator(".ui-transport__modes").getByRole("button", { name: "Loop" }).click();
      await page.locator(".ui-tracktable .ui-table__name").first().click();
      await chooseLength(page, "Pattern length 1 bar", "4 bars");
      await page.locator("#ui-detail").getByRole("group", { name: "Bars of kick" }).getByRole("button", { name: "Bar 2", exact: true }).click();
      await expect(ruler.locator(".ui-range-ruler__edit")).toHaveCount(2);
      await end.focus();
      await screenshot(page, "range-loop-editing", width);
      await page.keyboard.press("Escape");
    }
    expectSoundThroughout(await stopRms(page), "the play range changes");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
// The instruction without a range was cut to "drag a handle or tap two …" from 1280 px
// on: it wraps to at most two lines inside the chip's column.
for (const size of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }] as const) {
  test(`the whole-loop hint is never cut at ${size.width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(size);
    await startSession(page);
    const label = page.locator(".ui-range-row__label");
    await expect(label).toHaveText("Whole loop · drag a handle or tap two bars");
    const fit = await label.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      lines: Math.round(node.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(node).lineHeight)),
    }));
    expect(fit.scrollWidth, "no ellipsis").toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.lines, "two lines at most").toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}
