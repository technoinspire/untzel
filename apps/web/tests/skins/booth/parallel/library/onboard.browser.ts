// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The first tap plays the groove loop section of the
// melodic onboard (DSP onsets in its 12 tracks and none in the others), the pluck pulses,
// Song plays from the intro, and Drop moves the loop to the fullest section.
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors, screenshot } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  stats(): { readonly instances: readonly { readonly name: string; readonly onsetCount: number }[] } | null;
  session(): { readonly source: string; readonly mode: string | null; readonly position: { readonly section: string | null } | null };
}

const GROOVE = ["kick", "sub", "bass", "hat", "ohat", "shaker", "conga", "rim", "perc", "clap", "pad", "keys"];
const OUTSIDE = ["pluck", "lead", "choir", "rise", "riser", "down", "impact"];

const read = (page: Page) => page.evaluate(() => {
  const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
  return { stats: t.stats(), session: t.session() };
});

const onsets = async (page: Page): Promise<Map<string, number>> =>
  new Map(((await read(page)).stats?.instances ?? []).map((instance) => [instance.name, instance.onsetCount]));

for (const width of [390, 1440] as const) {
  test(`the onboard's first tap plays the groove, Song plays the intro, Drop moves the loop at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
    // Two bars at 124 BPM are 3.9 s: every groove track has played by then.
    await expect.poll(async () => {
      const now = await onsets(page);
      return GROOVE.filter((name) => (now.get(name) ?? 0) === 0);
    }, { timeout: 15_000 }).toEqual([]);
    const heard = await onsets(page);
    for (const name of OUTSIDE) expect(heard.get(name) ?? 0, `${name} stays out of the groove`).toBe(0);
    if (width < 700) {
      await expect(page.locator(".ui-tile.is-hinted")).toHaveCount(1);
      await expect(page.locator(".ui-tile.is-hinted")).toContainText("pluck");
    }
    await screenshot(page, "onboard-groove", width);
    await page.getByRole("button", { name: "Drop", exact: true }).click();
    await expect.poll(async () => (await read(page)).session.source).toMatch(/^section drop2 .* \| loop$/m);
    expect((await read(page)).session.source).not.toMatch(/^section groove .*\| loop$/m);
    if (width >= 700) {
      const songMode = page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Song", exact: true });
      await songMode.click();
      await expect.poll(async () => (await read(page)).session.position?.section ?? null, { timeout: 15_000 }).toBe("intro");
    }
    expect(errors).toEqual([]);
  });
}
