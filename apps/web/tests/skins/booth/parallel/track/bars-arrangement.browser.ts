// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Bars and arrangement,
// on the real session at 390 and 1440: one Length chip and no row of 16 bars;
// 8 bars written and shown on the next bar; bar thumbnails, "Editing bar 2 of 4", a step
// of bar 2 landing in bar 2 of the text; bar 1 copied into bar 3; the Song list, a part
// opened, a track turned off in it, its length set to 16, a part moved up; nothing of
// the arrangement in loop mode; the music never stops; the attribution stays.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectSoundThroughout, barsOf, lineOf, startRms, startSession, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

const NEXT_BAR_MS = 4_000;
/** Song mode enters on the next 4-bar phrase: 7.3 s at 132 BPM, plus margin. */
const NEXT_PHRASE_MS = 10_000;

async function chooseLength(page: Page, chip: string, bars: string): Promise<void> {
  await page.getByRole("button", { name: chip }).click();
  const picker = page.getByRole("dialog", { name: /length/i });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: bars, exact: true }).click();
  await expect(picker).toBeHidden();
}

/** Each musical length, the chip's whole label in view: "Pattern 16 ba…" once hid it. */
async function expectWholeLabels(page: Page, chip: Locator, name: (bars: number) => string): Promise<void> {
  for (const bars of [1, 2, 4, 8, 16]) {
    const current = await chip.getAttribute("aria-label");
    if (current !== name(bars)) await chooseLength(page, current ?? "", bars === 1 ? "1 bar" : `${bars} bars`);
    await expect(chip).toHaveAttribute("aria-label", name(bars));
    const overflow = await chip.evaluate((node) => {
      const label = node.querySelector(".ui-chip-length__label");
      return [node, label].filter((box): box is Element => box !== null).map((box) => box.scrollWidth - box.clientWidth);
    });
    expect(overflow, `${name(bars)}: label and chip overflow in px`).toEqual([0, 0]);
  }
}

test("the Length, Pattern and Part chips show their whole label at 390", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  const bars = (count: number): string => (count === 1 ? "1 bar" : `${count} bars`);
  await expectWholeLabels(page, page.locator(".ui-transport__length"), (count) => `Loop length ${bars(count)}`);
  await page.getByRole("button", { name: "Adjust kick", exact: true }).click();
  await expectWholeLabels(page, page.locator("#ui-detail .ui-detail__length"), (count) => `Pattern length ${bars(count)}`);
  await page.keyboard.press("Escape");
  await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
  await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
  const parts = page.getByRole("list", { name: "Parts of the song" });
  await expect(parts).toBeVisible({ timeout: NEXT_PHRASE_MS });
  await parts.getByRole("button").first().click();
  await expectWholeLabels(page, page.locator("#ui-part .ui-part__length"), (count) => `Part length ${bars(count)}`);
  await screenshot(page, "length-chips", 390);
  expect(errors).toEqual([]);
});

for (const width of [390, 1440] as const) {
  test(`bars and arrangement at ${width}, the music never stops`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    const isPhone = width < 700;
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);

    // A: one chip, no strip of numbered bars; the ruler is the play range's.
    const transport = page.locator(".ui-transport");
    await expect(transport.getByRole("button", { name: "Loop length 4 bars" })).toHaveCount(1);
    await expect(page.locator(".ui-bars, .ui-bars__bar")).toHaveCount(0);
    await expect(transport.getByRole("group", { name: "Play range" })).toBeVisible();
    await expect(transport.locator(".ui-transport__position")).toContainText(/bar [1-4] of 4/);
    // Loop mode: nothing of the arrangement.
    await expect(page.locator(".ui-arrangement, .ui-matrix, .ui-cell")).toHaveCount(0);
    await expect(page.locator(".ui-song__list")).toBeHidden();
    await chooseLength(page, "Loop length 4 bars", "8 bars");
    expect(await lineOf(page, "loop ")).toBe("loop 8");
    // Spoken once through the shell's polite region (playback-controls.ts); the bar
    // ticks of the ruler and of "bar N of M" stay silent.
    const status = page.locator(".ui-app > [role='status']");
    await expect(status).toHaveText("Loop of 8 bars from the next bar.");
    await expect(transport.locator(".ui-transport__position")).not.toHaveAttribute("aria-live");
    await expect(transport.getByRole("button", { name: "Loop length 8 bars" })).toHaveText("Length 8 bars");
    await expect(transport.locator(".ui-transport__position")).toContainText(/bar [1-8] of 8/, { timeout: NEXT_BAR_MS });
    await expect(transport.locator(".ui-range-ruler__cell")).toHaveCount(8);
    await screenshot(page, "length-8", width);

    // B: the kick with 4 bars, thumbnails, the bar being edited apart from the one playing.
    if (isPhone) await page.getByRole("button", { name: "Adjust kick", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").first().click();
    const detail = page.locator("#ui-detail");
    await expect(detail).toBeVisible();
    await expect(detail.locator(".ui-thumbs")).toBeHidden();
    await chooseLength(page, "Pattern length 1 bar", "4 bars");
    const thumbs = detail.getByRole("group", { name: "Bars of kick" });
    await expect(thumbs.getByRole("button")).toHaveCount(4);
    await expect(thumbs.getByRole("button", { name: "Bar 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(thumbs.locator('[aria-current="true"]')).toHaveCount(1, { timeout: NEXT_BAR_MS });
    await detail.getByRole("button", { name: "Next bar" }).click();
    await expect(detail.locator(".ui-detail__editing")).toHaveText("Editing bar 2 of 4");
    // Said by the shell's one polite region; the detail has no live region of its own, so
    // the share announcements stay one region to find (regression after the share merge).
    await expect(status).toHaveText("Editing bar 2 of 4");
    await expect(page.locator(".ui-app [aria-live]")).toHaveCount(1);
    await expect(detail.locator(".ui-detail__caption")).toHaveText("steps 1–8 · 9–16 of bar 2");
    await detail.getByRole("table", { name: "Steps, bar 2" }).getByRole("button", { name: "Step 2, rest" }).click();
    await expect.poll(() => barsOf(page, "kick")).toEqual(["x... x... x... x...", "xx.. x... x... x...", "x... x... x... x...", "x... x... x... x..."]);
    // Copy bar 1 (with a step of its own) and paste it into bar 3.
    await thumbs.getByRole("button", { name: "Bar 1" }).click();
    await detail.getByRole("table", { name: "Steps, bar 1" }).getByRole("button", { name: "Step 3, rest" }).click();
    await detail.getByRole("button", { name: "Copy bar" }).click();
    await thumbs.getByRole("button", { name: "Bar 3" }).click();
    await expect(detail.locator(".ui-detail__editing")).toHaveText("Editing bar 3 of 4");
    await detail.getByRole("button", { name: "Paste here" }).click();
    await expect.poll(() => barsOf(page, "kick")).toEqual(["x.x. x... x... x...", "xx.. x... x... x...", "x.x. x... x... x...", "x... x... x... x..."]);
    await screenshot(page, "bar-thumbnails", width);
    // Selection follows focus: → edits the next bar, no Enter needed.
    await thumbs.getByRole("button", { name: "Bar 3" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(detail.locator(".ui-detail__editing")).toHaveText("Editing bar 4 of 4");
    await expect(status).toHaveText("Editing bar 4 of 4");
    await expect(thumbs.getByRole("button", { name: "Bar 4" })).toHaveAttribute("aria-pressed", "true");
    await expect(thumbs.getByRole("button", { name: "Bar 4" })).toBeFocused();
    await expect(detail.locator(".ui-detail__caption")).toHaveText("steps 1–8 · 9–16 of bar 4");
    await screenshot(page, "bar-thumbnails-keyboard", width);
    await page.keyboard.press("Escape");

    // C: song mode, the parts in a list.
    if (isPhone) {
      await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
      await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
    } else {
      await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
    }
    const parts = page.getByRole("list", { name: "Parts of the song" });
    await expect(parts).toBeVisible({ timeout: NEXT_PHRASE_MS });
    // Each row is one part button and its rename pencil.
    await expect(parts.locator(".ui-partrow")).toHaveCount(6);
    await expect(parts.getByRole("button").first()).toHaveAccessibleName(/^intro, 8 bars · 3 tracks/);
    await parts.getByRole("button").first().click();
    const editor = page.locator("#ui-part");
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "sub in intro" }).click();
    await expect.poll(() => lineOf(page, "section intro")).toBe("section intro  kick hat");
    await expect(editor.getByRole("button", { name: "sub in intro" })).toHaveAttribute("aria-pressed", "false");
    await chooseLength(page, "Part length 8 bars", "16 bars");
    await expect.poll(() => lineOf(page, "song ")).toBe("song intro 16, build 4, drop 16, break 8, build 4, drop 16");
    await screenshot(page, "song-part", width);
    // Move the second part up, from its editor.
    if (isPhone) await page.keyboard.press("Escape");
    await parts.locator(".ui-partrow").nth(1).click();
    await expect(editor.locator(".ui-sheet__title")).toHaveText("build");
    await editor.getByRole("button", { name: "Move", exact: true }).click();
    await editor.getByRole("button", { name: "Move up" }).click();
    await expect.poll(() => lineOf(page, "song ")).toBe("song build 4, intro 16, drop 16, break 8, build 4, drop 16");
    await expect(editor.locator(".ui-part__meta")).toContainText("part 1 of 6");
    // Esc gives focus back to the part that moved, in its new row.
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();
    await expect(parts.getByRole("button").first()).toBeFocused();
    await expect(parts.getByRole("button").first()).toHaveAccessibleName(/^build,/);

    // Add part from what is playing writes a section and a part (no stub).
    await page.getByRole("button", { name: "Add part from what is playing" }).click();
    await expect.poll(() => lineOf(page, "song ")).toMatch(/, part\d* \d+$/);
    await expect(parts.locator(".ui-partrow")).toHaveCount(7);
    expect(await lineOf(page, "section part")).toMatch(/^section part\d*\s+\S/);

    // Back in loop mode, the arrangement is gone again.
    if (isPhone) {
      await page.locator(".ui-song__modes").getByRole("button", { name: "Loop" }).click();
    } else {
      await page.locator(".ui-transport__modes").getByRole("button", { name: "Loop" }).click();
    }
    await expect(parts).toBeHidden({ timeout: NEXT_PHRASE_MS });
    await expect(page.locator("#ui-part")).toBeHidden();

    const rms = await stopRms(page);
    expect(rms.slices, "500 ms slices sampled").toBeGreaterThan(10);
    expectSoundThroughout(rms, "bars and arrangement");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
