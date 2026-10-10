// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// "New track → hear something good in under 3 taps", timed and captured. Counts the taps
// and the time from the first one
// until the AnalyserNode RMS passes 0.005 with the new track, over music that is playing
// in silence (one muted track), so the only sound is the new one. Two paths:
// - Add track, then ▶ (hear) or + (add) on the first row the sheet shows (bongo: the
//   drums are alphabetical, kick is behind "Show all"): the goal is 2 taps;
// - the Blank project: the idle play button, then what the screen offers until the kick
//   sounds; the goal is 1 tap once the empty state is open (the Kick starter).
// The numbers are written before the goals are checked, so a run on main records the
// "before" even where it misses them. The written file is .cache/measurements/easy-start-*.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeMeasurement } from "../../support/measure-support";
import { RMS_THRESHOLD } from "../../support/session-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  rms(): number;
  applyText(text: string): void;
  session(): { readonly playing: boolean };
}
interface Probe {
  firstTap: number | null;
  heard: number | null;
}
type Window = typeof globalThis & { untzelTest: Hooks; easyStart?: Probe };

/** Plays, makes no sound: the transport runs and the new track is all that is heard. */
const SILENT = "tempo 124\nkey c minor\nloop 4\nhat: hat ..x. ..x. ..x. ..x. | mute\n";
/** Two bars at 124 BPM and margin: a track added with + enters on the next bar. */
const HEAR_MS = 8_000;
/** Longer than a bar at 132 BPM (1.82 s): the onboard is gone, only the muted track is left. */
const QUIET_MS = 2_500;

/** Samples the output in the page every 10 ms; `heard` is the first frame above the threshold. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((threshold) => {
    const scope = globalThis as Window;
    const probe: Probe = { firstTap: null, heard: null };
    scope.easyStart = probe;
    const timer = setInterval(() => {
      if (probe.firstTap === null) return;
      if (scope.untzelTest?.rms() > threshold) {
        probe.heard = performance.now();
        clearInterval(timer);
      }
    }, 10);
  }, RMS_THRESHOLD);
}

class TapCounter {
  readonly #page: Page;
  readonly taps: string[] = [];

  constructor(page: Page) {
    this.#page = page;
  }

  async tap(locator: Locator, name: string): Promise<void> {
    await locator.waitFor();
    if (this.taps.length === 0) {
      await this.#page.evaluate(() => {
        const probe = (globalThis as Window).easyStart;
        if (probe !== undefined) probe.firstTap = performance.now();
      });
    }
    this.taps.push(name);
    await locator.click();
  }
}

async function heardAfter(page: Page): Promise<number | null> {
  try {
    await page.waitForFunction(() => (globalThis as Window).easyStart?.heard !== null, undefined, { timeout: HEAR_MS });
  } catch {
    return null;
  }
  return page.evaluate(() => {
    const probe = (globalThis as Window).easyStart;
    return probe?.heard == null || probe.firstTap === null ? null : Math.round(probe.heard - probe.firstTap);
  });
}

async function isPlaying(page: Page): Promise<boolean> {
  return page.evaluate(() => (globalThis as Window).untzelTest.session().playing);
}

/** A running session that plays in silence. */
async function silentSession(page: Page): Promise<void> {
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as Window).untzelTest?.contextState() === "running");
  await page.evaluate((text) => (globalThis as Window).untzelTest.applyText(text), SILENT);
  // The old program plays to its bar boundary, and a hat has gaps between hits: silence
  // counts once it lasted QUIET_MS without one sample above the threshold.
  await page.evaluate(
    ([threshold, quietMs, timeout]) =>
      new Promise<void>((resolve, reject) => {
        const started = performance.now();
        let loud = started;
        const timer = setInterval(() => {
          const now = performance.now();
          if ((globalThis as Window).untzelTest.rms() > threshold) loud = now;
          if (now - loud >= quietMs) {
            clearInterval(timer);
            resolve();
          } else if (now - started > timeout) {
            clearInterval(timer);
            reject(new Error("the session never went silent"));
          }
        }, 10);
      }),
    [RMS_THRESHOLD, QUIET_MS, HEAR_MS * 2] as const,
  );
  expect(await isPlaying(page)).toBe(true);
  await armProbe(page);
}

async function openLibrary(page: Page, counter: TapCounter): Promise<Locator> {
  await counter.tap(page.getByRole("button", { name: "Add track" }).filter({ visible: true }).first(), "Add track");
  const library = page.locator("#ui-library");
  await expect(library).toBeVisible();
  return library;
}

interface Result {
  readonly path: string;
  readonly taps: readonly string[];
  /** From the first tap until the RMS passed the threshold; null: not heard. */
  readonly ms: number | null;
  /** Taps counted after the session opened (the Blank path). */
  readonly tapsInSession?: number;
}

function record(name: string, width: number, result: Result): void {
  // One file per repetition (--repeat-each): the time depends on where in the bar the tap lands.
  writeMeasurement(`easy-start-${name}-${width}-${test.info().repeatEachIndex}`, { date: new Date().toISOString(), viewport: VIEWPORTS[width as 390 | 1440], threshold: RMS_THRESHOLD, ...result });
}

for (const width of [390, 1440] as const) {
  test(`Add track, then ▶ on the first row: heard in 2 taps at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await silentSession(page);
    const counter = new TapCounter(page);
    const library = await openLibrary(page, counter);
    const preview = library.getByRole("button", { name: /^Preview / }).first();
    const name = (await preview.getAttribute("aria-label")) ?? "Preview";
    await counter.tap(preview, `▶ ${name.replace(/^Preview /, "")}`);
    const ms = await heardAfter(page);
    await screenshot(page, "easy-start-preview", width);
    record("preview", width, { path: "Add track → ▶", taps: counter.taps, ms });
    expect(ms, "the preview is heard").not.toBeNull();
    expect(counter.taps.length, "taps until the preview is heard").toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test(`Add track, then + on the first row: heard in 2 taps at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await silentSession(page);
    const counter = new TapCounter(page);
    const library = await openLibrary(page, counter);
    const add = library.locator(".ui-library__add").first();
    const name = (await add.getAttribute("aria-label")) ?? "Add";
    await counter.tap(add, `+ ${name.replace(/^Add /, "")}`);
    let ms = await heardAfter(page);
    if (ms === null && !(await isPlaying(page))) {
      await counter.tap(page.locator(".ui-transport__play"), "▶ play");
      ms = await heardAfter(page);
    }
    await screenshot(page, "easy-start-add", width);
    record("add", width, { path: "Add track → +", taps: counter.taps, ms });
    expect(ms, "the new track is heard").not.toBeNull();
    expect(counter.taps.length, "taps until the new track is heard").toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test(`Blank: a first sound heard in 1 tap once the project is open at ${width}`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./?template=blank");
    // The hooks exist once the engine runs; the probe waits for them.
    await armProbe(page);
    const counter = new TapCounter(page);
    // main: "Tap to play"; this front: "Start from scratch".
    await counter.tap(page.getByRole("button", { name: /^(Start from scratch|Tap to play)$/ }).filter({ visible: true }).first(), "idle play");
    await page.waitForFunction(() => (globalThis as Window).untzelTest?.contextState() === "running");
    const opened = counter.taps.length;
    await screenshot(page, "easy-start-blank-open", width);
    const starter = page.getByRole("button", { name: "Add kick and play" });
    if (await starter.isVisible()) {
      await counter.tap(starter, "Kick starter");
    } else {
      const library = await openLibrary(page, counter);
      await counter.tap(library.locator(".ui-library__add").first(), "+ first row");
    }
    let ms = await heardAfter(page);
    if (ms === null && !(await isPlaying(page))) {
      await counter.tap(page.locator(".ui-transport__play"), "▶ play");
      ms = await heardAfter(page);
    }
    await screenshot(page, "easy-start-blank-heard", width);
    const tapsInSession = counter.taps.length - opened;
    record("blank", width, { path: "Blank → play → kick", taps: counter.taps, ms, tapsInSession });
    expect(ms, "the first sound is heard").not.toBeNull();
    expect(tapsInSession, "taps after the project opened").toBe(1);
    expect(errors).toEqual([]);
  });
}
