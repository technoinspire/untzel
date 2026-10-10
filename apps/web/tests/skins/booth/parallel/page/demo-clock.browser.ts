// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The demo page's clock:
// under Playwright's fake clock, the engine's time is the page's performance.now() read as
// 48 kHz frames, so a second of virtual time is 48 000 frames exactly, whatever the machine
// does meanwhile; and the Code panel's sounding token follows that clock, not the
// AudioContext, which keeps real time. Test build, ?demo.
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

interface Hooks {
  currentFrame(): number;
  startFrame(): number | null;
  applyText(text: string): unknown;
  play(mode: "loop" | "song"): unknown;
}

type Scope = typeof globalThis & { untzelTest?: Hooks; untzelDemo?: unknown; soundingAt?: number[] };

/** 120 BPM, 8 steps a bar: a hit every second, on step 1 and step 5. */
const TEXT = "tempo 120\nkick: kick x... x...\n";

async function openDemo(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto("./?demo&template=blank");
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForFunction(() => (globalThis as Scope).untzelDemo !== undefined && (globalThis as Scope).untzelTest !== undefined);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

test("a second of virtual time is 48 000 frames of the engine's clock", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await openDemo(page);
  const read = (): Promise<{ readonly frame: number; readonly clock: number }> =>
    page.evaluate(() => ({ frame: (globalThis as Scope).untzelTest?.currentFrame() ?? Number.NaN, clock: Math.round(performance.now() * 48) }));
  const before = await read();
  expect(before.frame).toBe(before.clock);
  await page.clock.runFor(1_000);
  const after = await read();
  expect(after.frame).toBe(after.clock);
  expect(after.frame - before.frame).toBe(48_000);
  expect(errors).toEqual([]);
});

test("the Code panel's sounding token follows the virtual clock", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await openDemo(page);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await page.clock.runFor(500);
  await expect(page.getByRole("textbox", { name: "Untzel source" })).toBeVisible();
  // Every change of the sounding mark, at the page's (virtual) time.
  await page.evaluate(() => {
    const scope = globalThis as Scope;
    scope.soundingAt = [];
    let last = "";
    new MutationObserver(() => {
      const marks = [...document.querySelectorAll(".cm-content .u-sounding")];
      if (marks.length === 0) return;
      const key = marks.map((mark) => `${mark.textContent}@${Math.round(mark.getBoundingClientRect().left)}`).join("|");
      if (key === last) return;
      last = key;
      scope.soundingAt?.push(performance.now());
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.evaluate((text) => {
    const hooks = (globalThis as Scope).untzelTest;
    hooks?.applyText(text);
    hooks?.play("loop");
  }, TEXT);
  for (let step = 0; step < 50; step += 1) await page.clock.runFor(100);
  const startFrame = await page.evaluate(() => (globalThis as Scope).untzelTest?.startFrame() ?? null);
  expect(startFrame, "the play started").not.toBeNull();
  const changes = await page.evaluate(() => (globalThis as Scope).soundingAt ?? []);
  expect(changes.length, "the sounding token moved with every hit").toBeGreaterThanOrEqual(3);
  const start = (startFrame ?? 0) / 48;
  // A hit every 1 000 ms from the play's first frame; the mark is drawn within the frame after.
  for (const at of changes) {
    const offset = ((Math.round(at - start) % 1_000) + 1_000) % 1_000;
    expect(offset, `the mark at ${at} ms, ${at - start} ms after the play`).toBeLessThanOrEqual(34);
  }
  expect(errors).toEqual([]);
});
