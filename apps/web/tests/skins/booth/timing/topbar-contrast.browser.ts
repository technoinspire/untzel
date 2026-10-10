// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The top bar is transparent over the stage. Its
// text must keep contrast on the brightest stage: 48 stress tracks plus full-strength
// shockwaves and sparks scheduled on top of the music, crossing the bar. The bar's
// foreground is hidden while sampling, so each screenshot shows what is composited
// behind the text: stage, scrim and nothing else. The worst pixel behind each text decides.

import { expect, test, type Page } from "@playwright/test";
import { writeMeasurement } from "../support/measure-support";
import { contrast, decodePng, luminance, type Pixels } from "../../../support/png";
import { addStyleSheet } from "../../../support/style-sheet-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../support/support";

const SAMPLE_MS = 6_000;
const BURST_EVERY_MS = 200;
const STRESS_TRACKS = 48;
/** Layers the bursts light: the stress text names them kick…kick16 and hat…hat16. */
const PROBES = ["kick", "kick2", "kick3", "kick4", "kick5", "hat", "hat2", "hat3", "hat4", "hat5"];
const TEXT = luminance(255, 255, 255);
const STAGE = luminance(0x0b, 0x0b, 0x0c);

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Target {
  readonly name: string;
  readonly box: Box;
  readonly foreground: number;
  readonly minimum: number;
}

interface Hooks {
  audioTime(): number;
  scheduleLight(cues: readonly unknown[]): void;
}

/** Tight boxes of the bar's text (a Range, not the element) and of the logo, in CSS px. */
async function targets(page: Page): Promise<{ bar: Box; targets: Target[] }> {
  const boxes = await page.evaluate(() => {
    const box = (rect: DOMRect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    const textBox = (selector: string) => {
      const node = document.querySelector(selector);
      if (node === null) throw new Error(`missing ${selector}`);
      const range = document.createRange();
      range.selectNodeContents(node);
      return box(range.getBoundingClientRect());
    };
    const logo = document.querySelector(".ui-attribution__logo");
    const bar = document.querySelector(".ui-topbar");
    if (logo === null || bar === null) throw new Error("missing the top bar");
    return {
      bar: box(bar.getBoundingClientRect()),
      title: textBox(".ui-topbar__title"),
      logo: box(logo.getBoundingClientRect()),
    };
  });
  return {
    bar: boxes.bar,
    targets: [
      // Text: 4.5:1. The logo is a wordmark: 3:1, the non-text floor. The Attribution
      // Phrase sits in the footer on solid --stage (no stage light behind it).
      { name: "song title (text)", box: boxes.title, foreground: TEXT, minimum: 4.5 },
      { name: "Untzel wordmark", box: boxes.logo, foreground: TEXT, minimum: 3 },
    ],
  };
}

const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** Brightest pixel of a box (CSS px; the screenshot is at scale "css"). */
function brightest(pixels: Pixels, box: Box): number {
  let worst = 0;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(pixels.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(pixels.height, Math.ceil(box.y + box.height));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * pixels.width + x) * 4;
      const value =
        0.2126 * (LINEAR[pixels.data[index] ?? 0] ?? 0) +
        0.7152 * (LINEAR[pixels.data[index + 1] ?? 0] ?? 0) +
        0.0722 * (LINEAR[pixels.data[index + 2] ?? 0] ?? 0);
      if (value > worst) worst = value;
    }
  }
  return worst;
}

/** Full-strength accents on the probe layers, just ahead of what is being heard. */
async function burst(page: Page): Promise<void> {
  await page.evaluate((probes) => {
    const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
    const at = t.audioTime() + 0.02;
    t.scheduleLight(probes.map((track) => ({
      track,
      audioTime: at,
      duration: 0.2,
      velocity: 1,
      isAccent: true,
      tone: 1,
    })));
  }, PROBES);
}

for (const width of [390, 1440] as const) {
  test(`top bar text keeps contrast over the brightest stage at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto(`./?stress=${STRESS_TRACKS}`);
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await page.waitForFunction(() => document.documentElement.dataset["renderer"] !== undefined);
    const { bar, targets: list } = await targets(page);
    const removeHiding = await addStyleSheet(page, ".ui-topbar > * { visibility: hidden !important; }");

    const worst = new Map(list.map((target) => [target.name, STAGE]));
    // The bar's bottom row, under no text: proves the light reaches the bar at all.
    const bottomRow: Box = { x: 0, y: bar.height - 2, width: bar.width, height: 2 };
    let lightUnderBar = 0;
    let frames = 0;
    const end = Date.now() + SAMPLE_MS;
    let nextBurst = 0;
    while (Date.now() < end) {
      if (Date.now() >= nextBurst) {
        await burst(page);
        nextBurst = Date.now() + BURST_EVERY_MS;
      }
      const pixels = decodePng(await page.screenshot({ clip: bar, scale: "css", animations: "allow" }));
      frames += 1;
      for (const target of list) {
        const local = { ...target.box, x: target.box.x - bar.x, y: target.box.y - bar.y };
        worst.set(target.name, Math.max(worst.get(target.name) ?? 0, brightest(pixels, local)));
      }
      lightUnderBar = Math.max(lightUnderBar, brightest(pixels, bottomRow));
    }

    // For the contact sheet: the bar with its text over the stage at full strength.
    await removeHiding();
    await burst(page);
    await page.waitForTimeout(150);
    await screenshot(page, "topbar-bright", width);

    const results = list.map((target) => {
      const background = worst.get(target.name) ?? 1;
      return {
        name: target.name,
        box: target.box,
        brightestBackground: Number(background.toFixed(4)),
        contrast: Number(contrast(target.foreground, background).toFixed(2)),
        minimum: target.minimum,
      };
    });
    writeMeasurement(`topbar-contrast-${width}`, {
      date: new Date().toISOString(),
      viewport: VIEWPORTS[width],
      stressTracks: STRESS_TRACKS,
      renderer: await page.evaluate(() => document.documentElement.dataset["renderer"]),
      frames,
      lightUnderBar: Number(lightUnderBar.toFixed(4)),
      results,
    });
    expect(frames, "screenshots sampled").toBeGreaterThan(20);
    expect(lightUnderBar, "the stage's light shows through the bar").toBeGreaterThan(STAGE * 4);
    for (const result of results) {
      expect(result.contrast, `${result.name} over the brightest stage`).toBeGreaterThanOrEqual(result.minimum);
    }
    expect(errors).toEqual([]);
  });
}
