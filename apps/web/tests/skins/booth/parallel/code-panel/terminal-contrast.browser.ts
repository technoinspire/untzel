// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Contrast of the composer terminal's text,
// measured, not estimated: with the music and the light stage running, the
// terminal's text is made transparent, and the brightest pixel behind each light label
// (the darkest behind the dark label of Apply) decides, over several frames. Written to
// .cache/measurements/terminal-contrast-<width>.json for the verification notes.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contrast, decodePng, luminance, type Pixels } from "../../../../support/png";
import { addStyleSheet } from "../../../../support/style-sheet-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

const FRAMES = 8;
const TEXT = luminance(255, 255, 255);
const MUTED = luminance(0xaa, 0xa5, 0xa1);
const FLARE = luminance(0xf6, 0x5d, 0x00);
const STAGE = luminance(0x0b, 0x0b, 0x0c);
const OUT = join(process.env["UNTZEL_SCREENSHOTS"] ?? join(process.cwd(), "../../.cache/screenshots"), "../measurements");

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Target {
  readonly name: string;
  readonly selector: string;
  readonly foreground: number;
  /** "light" text on a darker fill: the brightest pixel decides; "dark" the opposite. */
  readonly kind: "light" | "dark";
  readonly minimum: number;
}

const TARGETS: readonly Target[] = [
  { name: "echo (text-muted on stage)", selector: ".ut-echo__line", foreground: MUTED, kind: "light", minimum: 4.5 },
  { name: "applied (text on stage)", selector: ".ut-applied__summary", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "on the next bar (text-muted)", selector: ".ut-applied__detail", foreground: MUTED, kind: "light", minimum: 4.5 },
  { name: "error message (text)", selector: ".ut-group--error .ut-row:not(.ut-row--muted)", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "Did you mean (text-muted)", selector: ".ut-group--error .ut-row--muted", foreground: MUTED, kind: "light", minimum: 4.5 },
  { name: "suggestion chip (text on surface)", selector: ".ut-chip--suggestion", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "preview title (text)", selector: ".ut-preview__title", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "added line (text on flare 16 %)", selector: ".ut-diff__line--added .ut-diff__text", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "added sign (flare on flare 16 %)", selector: ".ut-diff__line--added .ut-diff__sign", foreground: FLARE, kind: "light", minimum: 4.5 },
  { name: "removed line (text-muted)", selector: ".ut-diff__line--removed .ut-diff__text", foreground: MUTED, kind: "light", minimum: 4.5 },
  { name: "Apply (stage on flare)", selector: ".ut-action--apply", foreground: STAGE, kind: "dark", minimum: 4.5 },
  { name: "Cancel (text on raised)", selector: ".ut-action--cancel", foreground: TEXT, kind: "light", minimum: 4.5 },
  { name: "usage hint (text-muted on stage)", selector: ".ut-hint", foreground: MUTED, kind: "light", minimum: 4.5 },
  { name: "command line (text on raised)", selector: ".ut-field__input", foreground: TEXT, kind: "light", minimum: 4.5 },
];

const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function extreme(pixels: Pixels, box: Box, kind: "light" | "dark"): number {
  let worst = kind === "light" ? 0 : 1;
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
      worst = kind === "light" ? Math.max(worst, value) : Math.min(worst, value);
    }
  }
  return worst;
}

/**
 * The tight box of the newest label for a selector, scrolled into view inside the log
 * first (a Range over its text; the input's text band; a button's label area).
 */
async function boxOf(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((query) => {
    const nodes = [...document.querySelectorAll(query)];
    const node = nodes.at(-1);
    if (node === undefined) return null;
    node.scrollIntoView({ block: "center", inline: "nearest" });
    let rect = node.getBoundingClientRect();
    if (node instanceof HTMLInputElement) {
      rect = new DOMRect(rect.x, rect.y + 12, Math.min(rect.width, 200), rect.height - 24);
    } else if (node.matches(".ut-chip, .ut-action")) {
      rect = new DOMRect(rect.x + 12, rect.y + 10, rect.width - 24, rect.height - 20);
    } else {
      const range = document.createRange();
      range.selectNodeContents(node);
      rect = range.getBoundingClientRect();
    }
    // Only what is really on screen counts: the centre must be the label or inside it.
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    if (top === null || !(top === node || node.contains(top) || top.contains(node))) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);
}

async function measure(page: Page, target: Target): Promise<number | null> {
  const box = await boxOf(page, target.selector);
  if (box === null) return null;
  const removeHiding = await addStyleSheet(
    page,
    ".ut-terminal *, .ut-terminal *::placeholder { color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; }",
  );
  let worst: number | null = null;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, box.width), height: Math.max(1, box.height) };
    const pixels = decodePng(await page.screenshot({ clip, scale: "css", animations: "allow" }));
    const value = extreme(pixels, { x: 0, y: 0, width: pixels.width, height: pixels.height }, target.kind);
    worst = worst === null ? value : target.kind === "light" ? Math.max(worst, value) : Math.min(worst, value);
    await page.waitForTimeout(60);
  }
  await removeHiding();
  return worst === null ? null : Math.round(contrast(target.foreground, worst) * 100) / 100;
}

for (const width of [390, 1440] as const) {
  test(`terminal text keeps contrast at ${width}, measured over the worst pixel`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    // The phase 1 onboard: "remove ride" needs its ride track.
    await page.goto("./?template=phase1-onboard");
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
    await page.getByRole("button", { name: "Commands" }).click();
    const input = page.getByRole("combobox", { name: "Command" });
    const results: { name: string; ratio: number | null; minimum: number }[] = [];
    const record = async (names: readonly string[]): Promise<void> => {
      for (const target of TARGETS.filter((entry) => names.includes(entry.selector))) {
        results.push({ name: target.name, ratio: await measure(page, target), minimum: target.minimum });
      }
    };
    const run = async (line: string): Promise<void> => {
      await input.fill(line);
      await input.press("Enter");
    };
    await run("tempo 124");
    await record([".ut-echo__line", ".ut-applied__summary", ".ut-applied__detail"]);
    await run("tmepo 124");
    await record([".ut-group--error .ut-row:not(.ut-row--muted)", ".ut-group--error .ut-row--muted", ".ut-chip--suggestion"]);
    await input.fill("set bass c");
    await expect(page.locator(".ut-hint")).toBeVisible();
    await record([".ut-hint", ".ut-field__input"]);
    await run("remove ride");
    await expect(page.locator(".ut-preview")).toBeVisible();
    await record([
      ".ut-preview__title",
      ".ut-diff__line--added .ut-diff__text",
      ".ut-diff__line--added .ut-diff__sign",
      ".ut-diff__line--removed .ut-diff__text",
      ".ut-action--apply",
      ".ut-action--cancel",
    ]);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `terminal-contrast-${width}.json`), `${JSON.stringify({ width, frames: FRAMES, results }, null, 2)}\n`);
    expect(results).toHaveLength(TARGETS.length);
    for (const result of results) {
      expect(result.ratio, `${result.name} must be on screen`).not.toBeNull();
      expect(result.ratio ?? 0, result.name).toBeGreaterThanOrEqual(result.minimum);
    }
    expect(errors).toEqual([]);
  });
}
