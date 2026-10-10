// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Drag down to close on the real session at
// 390 × 844: every sheet with a handle follows the finger, closes past 30% of its height
// or on a flick, snaps back from a short drag, and hands focus back to its opener. A drag
// in a scrolled body scrolls; it never closes.

import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../support/support";

interface SheetCase {
  readonly name: string;
  readonly sheet: string;
  readonly opener: (page: Page) => Locator;
}

const SHEETS: readonly SheetCase[] = [
  { name: "Add track", sheet: "#ui-library", opener: (page) => page.locator(".ui-tracks").getByRole("button", { name: "Add track" }) },
  { name: "track detail", sheet: "#ui-detail", opener: (page) => page.getByRole("button", { name: "Adjust kick", exact: true }) },
  { name: "Code", sheet: "#ui-code", opener: (page) => page.locator(".ui-transport__code") },
];

async function startEngine(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
}

interface Grab {
  readonly x: number;
  readonly y: number;
  readonly sheetTop: number;
  readonly height: number;
}

/** A point in the header's top padding: header, not title or button. */
async function grab(sheet: Locator): Promise<Grab> {
  const box = await sheet.boundingBox();
  const header = await sheet.locator(".ui-sheet__header").boundingBox();
  if (box === null || header === null) throw new Error("sheet not laid out");
  return { x: header.x + header.width * 0.4, y: header.y + 8, sheetTop: box.y, height: box.height };
}

/** Moves in steps, then holds still before release, so the release is never a flick. */
async function slowMouseDrag(page: Page, from: Grab, distance: number, onHeld?: () => Promise<void>): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(from.x, from.y + (distance * step) / 20);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(250);
  await onHeld?.();
  await page.mouse.up();
}

/** Time between the flick's events: one 60 Hz frame. */
const FLICK_STEP_MS = 16;
/**
 * A short fast flick with explicit event timestamps (CDP), so its speed is the one written
 * here and not the scheduler's: under load, page.mouse spaced the moves out and the
 * release stopped counting as a flick. Chrome carries the timestamp into event.timeStamp.
 */
async function flick(page: Page, from: Grab, offsets: readonly number[]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const startSeconds = Date.now() / 1000;
  const send = (type: "mousePressed" | "mouseMoved" | "mouseReleased", offset: number, step: number) =>
    cdp.send("Input.dispatchMouseEvent", {
      type,
      x: from.x,
      y: from.y + offset,
      button: "left",
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount: 1,
      timestamp: startSeconds + (step * FLICK_STEP_MS) / 1000,
    });
  await send("mousePressed", 0, 0);
  for (const [index, offset] of offsets.entries()) await send("mouseMoved", offset, index + 1);
  await send("mouseReleased", offsets[offsets.length - 1] ?? 0, offsets.length);
  await cdp.detach();
}
async function openSheet(page: Page, sheetCase: SheetCase): Promise<Locator> {
  await sheetCase.opener(page).click();
  const sheet = page.locator(sheetCase.sheet);
  await expect(sheet, `${sheetCase.name} opens`).toBeVisible();
  // Past the entry transition: the resting position is the reference.
  await page.waitForTimeout(300);
  return sheet;
}

async function expectClosed(page: Page, sheetCase: SheetCase, sheet: Locator, how: string): Promise<void> {
  await expect(sheet, `${sheetCase.name} stays open after ${how}`).toBeHidden({ timeout: 2_000 });
  await expect(page.locator(".ui-app")).toHaveAttribute("data-overlay", "none");
  await expect(page.locator(".ui-app")).toHaveAttribute("data-panel", "none");
  await expect(sheetCase.opener(page), `focus returns to the opener after ${how}`).toBeFocused();
}

for (const sheetCase of SHEETS) {
  test(`${sheetCase.name} closes when dragged down past 30% and snaps back from a short drag at 390`, async ({ page }) => {
    const errors = collectErrors(page);
    await startEngine(page);

    let sheet = await openSheet(page, sheetCase);
    let from = await grab(sheet);
    await slowMouseDrag(page, from, from.height * 0.15, async () => {
      const held = await sheet.boundingBox();
      expect(held?.y ?? 0, "the sheet follows the finger").toBeGreaterThan(from.sheetTop + from.height * 0.1);
    });
    await page.waitForTimeout(400);
    await expect(sheet, `${sheetCase.name} closed after a short drag`).toBeVisible();
    expect(Math.abs(((await sheet.boundingBox())?.y ?? 0) - from.sheetTop), "snaps back to rest").toBeLessThan(1);

    from = await grab(sheet);
    await slowMouseDrag(page, from, from.height * 0.4);
    await expectClosed(page, sheetCase, sheet, "a drag past 30%");

    sheet = await openSheet(page, sheetCase);
    from = await grab(sheet);
    await flick(page, from, [20, 45, 70]);
    await expectClosed(page, sheetCase, sheet, "a short fast flick");
    expect(errors).toEqual([]);
  });
}

test("with reduced motion the sheet stays put while dragged and closes on release past 30%", async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startEngine(page);
  const sheetCase = SHEETS[0]!;
  const sheet = await openSheet(page, sheetCase);
  const from = await grab(sheet);
  await slowMouseDrag(page, from, from.height * 0.4, async () => {
    expect(Math.abs(((await sheet.boundingBox())?.y ?? 0) - from.sheetTop), "no follow animation").toBeLessThan(1);
  });
  await expectClosed(page, sheetCase, sheet, "a drag past 30% with reduced motion");
  expect(errors).toEqual([]);
});

test.describe("touch in the sheet body", () => {
  test.use({ hasTouch: true });

  async function touchDrag(cdp: CDPSession, x: number, y: number, distance: number): Promise<void> {
    const point = (dy: number) => [{ x, y: y + dy, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
    for (let step = 1; step <= 20; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point((distance * step) / 20) });
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  test("a drag down from the top of the body closes; in a scrolled body it scrolls", async ({ page }) => {
    const errors = collectErrors(page);
    await startEngine(page);
    const cdp = await page.context().newCDPSession(page);
    const sheetCase = SHEETS[1]!;

    let sheet = await openSheet(page, sheetCase);
    const body = sheet.locator(".ui-sheet__body");
    const scrollable = await body.evaluate((node) => node.scrollHeight - node.clientHeight);
    expect(scrollable, "the detail body scrolls at 390 × 844").toBeGreaterThan(40);
    await body.evaluate((node) => (node.scrollTop = node.scrollHeight));
    const bodyBox = await body.boundingBox();
    if (bodyBox === null) throw new Error("body not laid out");
    // In the body's own left padding: no control under the finger.
    const start = { x: bodyBox.x + 4, y: bodyBox.y + bodyBox.height * 0.3 };
    const scrolledFrom = await body.evaluate((node) => node.scrollTop);
    await touchDrag(cdp, start.x, start.y, 300);
    await page.waitForTimeout(300);
    await expect(sheet, "a drag in a scrolled body does not close").toBeVisible();
    expect(await body.evaluate((node) => node.scrollTop), "the body scrolled instead").toBeLessThan(scrolledFrom - 30);

    await body.evaluate((node) => (node.scrollTop = 0));
    const from = await grab(sheet);
    await touchDrag(cdp, start.x, start.y, from.height * 0.4);
    await expectClosed(page, sheetCase, sheet, "a touch drag from the top of the body");

    sheet = await openSheet(page, sheetCase);
    await expect(sheet).toBeVisible();
    expect(errors).toEqual([]);
  });
});
