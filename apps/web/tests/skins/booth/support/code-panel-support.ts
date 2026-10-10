// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Shared by the code panel tests: a text with every
// token category, the expected colors, and how to open and read the panel.

import { expect, type Page } from "@playwright/test";
import { luminance } from "../../../support/png";
import { VIEWPORTS, type ViewportWidth } from "../../../support/support";

export interface Hooks {
  contextState(): string;
  applyText(text: string): void;
  stop(): void;
  session(): { readonly source: string; readonly valid: boolean };
}

/** Every category of the token table that kick, hat and bass can write validly. */
export const SAMPLE = `// every token category
tempo 132
key c minor
swing 0.08
loop 4

kick:  kick  punch  x... X... x... x!..  | drive 0.3
hat:   hat   ..x. ..x. ..x. ..xx  | decay 0.08
ride:  hat   x.x. x.x. x.x. x.x.  | open 0.7 | gain 0.4 | pan -0.3 | reverb sea
sub:   bass  c1 . . c1 . . c1 .   | cutoff 180
bass:  bass  . c2 ~ c2 . c2 . eb2 | cutoff sine(8) 300..1400 | pan 0.2 | delay 1/8 | free

section intro  kick hat sub
section build  kick hat ride sub
section drop   kick hat ride sub bass
section break  hat bass

song intro 8, build 4, drop 16, break 8
`;

/** Expected computed colors per class (styles/language.css). */
export const EXPECTED: Readonly<Record<string, string>> = {
  "u-tok-keyword": "rgb(236, 230, 224)",
  "u-tok-signal": "rgb(255, 154, 92)",
  "u-tok-instrument": "rgb(233, 201, 168)",
  "u-tok-sound": "rgb(196, 164, 132)",
  "u-tok-pitch": "rgb(255, 193, 77)",
  "u-tok-param": "rgb(170, 165, 161)",
  "u-tok-sustain": "rgb(170, 165, 161)",
  "u-tok-value": "rgb(233, 201, 168)",
  "u-tok-number": "rgb(255, 255, 255)",
  "u-section-name": "rgb(255, 255, 255)",
  "u-tok-punct": "rgb(170, 165, 161)",
  "u-tok-comment": "rgb(138, 133, 128)",
  "u-tok-accent": "rgb(255, 255, 255)",
  "u-hit": "rgb(255, 255, 255)",
  "u-hit-accent": "rgb(255, 255, 255)",
  "u-rest": "rgb(138, 133, 128)",
};

export const TRACK_PALETTE = ["#F65D00", "#FFC14D", "#FF7A6B", "#E9C9A8", "#F2A0B5", "#D9B45A", "#8FD3C1", "#C7B3FF"];
export const SURFACE = luminance(0x16, 0x17, 0x19);

export function rgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
}

export async function openCode(page: Page, width: ViewportWidth, text = SAMPLE): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
  await page.evaluate((source) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.applyText(source), text);
  await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator("#ui-code .cm-content")).toBeVisible();
  await expect(page.locator(".u-tok-keyword").first()).toBeVisible();
}

/** The computed color of the first element of each class, and every color in the text. */
export async function colors(page: Page): Promise<{ byClass: Record<string, string | null>; distinct: number }> {
  return page.evaluate((classes) => {
    const byClass: Record<string, string | null> = {};
    for (const name of classes) {
      // The sounding pill paints over a token in rhythm; sample one that is not sounding.
      const node = [...document.querySelectorAll(`.cm-content .${name}`)].find(
        (candidate) => candidate.closest(".u-sounding") === null && candidate.querySelector(".u-sounding") === null,
      );
      byClass[name] = node === undefined ? null : getComputedStyle(node).color;
    }
    const all = new Set<string>();
    for (const node of document.querySelectorAll(".cm-content .cm-line *")) all.add(getComputedStyle(node).color);
    return { byClass, distinct: all.size };
  }, Object.keys(EXPECTED));
}

/** Class of each track's gutter bar and name, by track. */
export async function trackClasses(page: Page): Promise<Record<string, { name: string; bar: string }>> {
  return page.evaluate(() => {
    const out: Record<string, { name: string; bar: string }> = {};
    const bars = [...document.querySelectorAll(".u-track-gutter .cm-gutterElement")];
    for (const name of document.querySelectorAll(".u-track-name")) {
      const color = [...name.classList].find((entry) => /^u-track-\d$/.test(entry)) ?? "";
      const line = name.closest(".cm-line");
      const top = line?.getBoundingClientRect().top ?? -1;
      const bar = bars.find((entry) => Math.abs(entry.getBoundingClientRect().top - top) < 2);
      out[name.textContent ?? ""] = { name: color, bar: [...(bar?.classList ?? [])].find((entry) => /^u-track-\d$/.test(entry)) ?? "" };
    }
    return out;
  });
}
