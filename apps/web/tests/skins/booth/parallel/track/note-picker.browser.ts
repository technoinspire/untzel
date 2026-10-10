// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Changing notes, on the real session
// at 390 and 1440 with the onboard bass, a pitched instrument without chords: step 2 to
// c3 (another octave), step 3 a hold, step 5 from a rest to g2, and Scale lock off
// writing `free`. A first tap on a key only previews: the text changes on Choose or on a
// second tap. Every touch asks for exactly one audition through the page's NoteAudition,
// which plays it on the DSP's preview slot. The text shows
// exactly those edits; the music never stops.
// Piano and chords (Fm7) are covered by unit tests; this test keeps to the bass.

import { expect, test, type Page } from "@playwright/test";
import { expectSoundThroughout, barsOf, lineOf, sourceOf, startRms, startSession, stopRms } from "../../support/session-support";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot } from "../../../../support/support";

interface AuditionEvent {
  readonly track: string;
  readonly sound: { readonly kind: string; readonly note?: string };
  readonly durationMs: number;
}

/** What the touched notes asked to sound, from the page's NoteAudition. */
function auditions(page: Page): Promise<readonly AuditionEvent[]> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: { auditions(): readonly AuditionEvent[] } }).untzelTest.auditions());
}
/** Notes the DSP started on its preview slot: a touch that reached the sound. */
function previewOnsets(page: Page): Promise<number> {
  return page.evaluate(() => {
    const stats = (globalThis as unknown as { untzelTest: { stats(): { instances: readonly { name: string; onsetCount: number }[] } | null } }).untzelTest.stats();
    return stats?.instances.find((instance) => instance.name === "#preview")?.onsetCount ?? 0;
  });
}

for (const width of [390, 1440] as const) {
  test(`the note picker edits the bass at ${width}, the music never stops`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await startRms(page);
    expect(await barsOf(page, "bass")).toEqual([". c2 . c2 . c2 . eb2"]);

    if (width < 700) await page.getByRole("button", { name: "Adjust bass", exact: true }).click();
    else await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: /^bass/ }).click();
    const detail = page.locator("#ui-detail");
    const grid = detail.getByRole("table", { name: "Steps, bar 1" });
    const picker = detail.locator(".ui-picker");

    // Step 2: c2 → c3. Touching the step plays its c2; the first tap on a key only plays.
    await expect(detail.getByRole("switch", { name: "Preview sounds" })).toHaveAttribute("aria-checked", "true");
    // A plain tap on the unscrolled sheet, as a person does: no scrolling by Playwright.
    await detail.locator(".ui-sheet__body").evaluate((body) => body.scrollTo({ top: 0 }));
    await grid.getByRole("button", { name: "Step 2, c2" }).dispatchEvent("click");
    await expect(picker).toBeVisible();
    await expect(picker.locator(".ui-piano__key[aria-pressed='true']")).toHaveAccessibleName("C 2");
    // At 390 Choose once opened partly under the Duplicate/Delete footer.
    // Without any scrolling by the test, its centre and both ends are Choose itself.
    const covered = await picker.locator(".ui-picker__choose").evaluate((choose) => {
      const rect = choose.getBoundingClientRect();
      // Inside the pill's rounded ends, which hit testing leaves out.
      const [x, y, inset] = [rect.left + rect.width / 2, rect.top + rect.height / 2, rect.height / 2];
      const points = [[x, rect.top + 3], [x, rect.bottom - 3], [rect.left + inset, y], [rect.right - inset, y], [x, y]] as const;
      return points.filter(([x, y]) => !choose.contains(document.elementFromPoint(x, y))).length;
    });
    expect(covered, "points of Choose hidden by the footer").toBe(0);
    expect((await auditions(page)).at(-1)).toEqual({ track: "bass", sound: { kind: "note", note: "c2" }, durationMs: 400 });
    // The touch sounds: the preview slot of the DSP started a note.
    await expect.poll(() => previewOnsets(page), { timeout: 10_000, message: "preview onsets in the DSP" }).toBeGreaterThan(0);
    const before = await sourceOf(page);
    const heard = (await auditions(page)).length;
    await picker.getByRole("button", { name: "C 3", exact: true }).click();
    expect(await sourceOf(page), "an audition does not change the text").toBe(before);
    const after = await auditions(page);
    expect(after.length - heard, "exactly one audition per touch").toBe(1);
    expect(after.at(-1)).toEqual({ track: "bass", sound: { kind: "note", note: "c3" }, durationMs: 400 });
    await expect(picker.getByRole("button", { name: "Choose c3" })).toBeVisible();
    await screenshot(page, "note-picker", width);
    await picker.getByRole("button", { name: "Choose c3" }).click();
    await expect.poll(() => barsOf(page, "bass")).toEqual([". c3 . c2 . c2 . eb2"]);

    // Step 3: a hold makes the c3 two steps long.
    await grid.getByRole("button", { name: "Step 3, rest" }).click();
    await picker.getByRole("button", { name: "Hold", exact: true }).click();
    await expect.poll(() => barsOf(page, "bass")).toEqual([". c3 ~ c2 . c2 . eb2"]);

    // Step 5: a rest opens on the last note before it; a second tap on g2 writes it.
    await grid.getByRole("button", { name: "Step 5, rest" }).click();
    await expect(picker.locator(".ui-piano__key[aria-pressed='true']")).toHaveCount(0);
    await expect(picker.locator(".ui-picker__holds")).toHaveText("Rest");
    await expect(picker.locator(".ui-piano__key.is-pending")).toHaveAccessibleName("C 2");
    await picker.getByRole("button", { name: "G 2", exact: true }).click();
    await picker.getByRole("button", { name: "G 2", exact: true }).click();
    await expect.poll(() => barsOf(page, "bass")).toEqual([". c3 ~ c2 g2 c2 . eb2"]);

    // Scale lock off writes `free`; a note out of the key is then played as written.
    await grid.getByRole("button", { name: "Step 4, c2" }).click();
    await expect(picker.getByRole("switch", { name: "Scale lock" })).toHaveAttribute("aria-checked", "true");
    await picker.getByRole("button", { name: "E 2", exact: true }).click();
    await expect(picker.locator(".ui-picker__warning")).toHaveText("c minor moves this note to the scale; turn off Scale lock to play it");
    // Said by the shell's one polite region; the picker has no live region of its own.
    await expect(page.locator(".ui-app > [role='status']")).toHaveText("c minor moves this note to the scale; turn off Scale lock to play it");
    await expect(page.locator(".ui-app [aria-live]")).toHaveCount(1);
    await picker.getByRole("switch", { name: "Scale lock" }).click();
    await expect.poll(() => lineOf(page, "bass:")).toMatch(/\| free$/);
    await expect(picker.getByRole("switch", { name: "Scale lock" })).toHaveAttribute("aria-checked", "false");

    // Esc closes the picker, not the sheet, and focus goes back to the step.
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(grid.getByRole("button", { name: "Step 4, c2" })).toBeFocused();

    // Listen a little longer: the edits above can take under 3 s on a quiet machine.
    await page.waitForTimeout(2_000);
    const rms = await stopRms(page);
    expect(rms.slices, "500 ms slices sampled").toBeGreaterThan(4);
    expectSoundThroughout(rms, "note picker");
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
