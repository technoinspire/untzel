// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const VIEWPORTS = {
  390: { width: 390, height: 844 },
  768: { width: 768, height: 1024 },
  1024: { width: 1024, height: 768 },
  1440: { width: 1440, height: 900 },
} as const;

export type ViewportWidth = keyof typeof VIEWPORTS;

export const ATTRIBUTION_URL = "https://untzel.com";
export const ATTRIBUTION_PHRASE = "Powered by Untzel · Techno Inspire";
/** The Attribution Copyright Notice of ATTRIBUTION.md, in the legal line of the waiting screen. */
export const COPYRIGHT_NOTICE = "Copyright (c) 2026 Techno Inspire";

const SCREENSHOTS = process.env["UNTZEL_SCREENSHOTS"] ?? join(process.cwd(), "../../.cache/screenshots");

/** Console errors and page errors; a test ends by asserting this is empty. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function screenshot(page: Page, state: string, width: ViewportWidth): Promise<void> {
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(SCREENSHOTS, `${state}-${width}.png`), fullPage: true });
}

/** A full-page capture at a window size outside VIEWPORTS, in sizes/: the contact sheet keeps its four widths. */
export async function sizedScreenshot(page: Page, name: string): Promise<void> {
  const directory = join(SCREENSHOTS, "sizes");
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}
/** One element alone, next to the page captures and in the same contact sheet. */
export async function elementScreenshot(locator: Locator, state: string, width: ViewportWidth): Promise<void> {
  mkdirSync(SCREENSHOTS, { recursive: true });
  await locator.screenshot({ path: join(SCREENSHOTS, `${state}-${width}.png`) });
}

/**
 * The license check: present, not zero-sized, not transparent, not hidden,
 * inside the viewport and not covered by anything else.
 */
export async function expectUnobstructed(locator: Locator, minHeight = 0): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const problem = await locator.evaluate((node, min) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return `zero size ${rect.width}×${rect.height}`;
    if (rect.height < min) return `${rect.height}px high, needs ${min}px`;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return "offscreen";
    for (let current: Element | null = node; current !== null; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none") return `display none on ${current.tagName}`;
      if (style.visibility !== "visible") return `visibility ${style.visibility} on ${current.tagName}`;
      if (Number(style.opacity) < 0.99) return `opacity ${style.opacity} on ${current.tagName}`;
      if (style.clipPath !== "none" && style.clipPath !== "") return `clip-path on ${current.tagName}`;
    }
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const top = document.elementFromPoint(x, y);
    if (top === null || !(top === node || node.contains(top) || top.contains(node))) {
      return `covered by ${top?.tagName ?? "nothing"}.${top?.className ?? ""}`;
    }
    return null;
  }, minHeight);
  expect(problem, "attribution must be visible").toBeNull();
}

export async function expectAttribution(page: Page): Promise<void> {
  // The Untzel wordmark linked in the top bar, the phrase in the footer.
  const link = page.locator(`a[href="${ATTRIBUTION_URL}"]`).filter({ has: page.locator('img[alt="Untzel"]') });
  await expect(link).toHaveCount(1);
  await expectUnobstructed(link.locator("img"), 16);
  await expectUnobstructed(page.getByText(ATTRIBUTION_PHRASE, { exact: true }));
}

/** The waiting screen (idle) carries the Attribution Copyright Notice, unobstructed. */
export async function expectCopyrightNotice(page: Page): Promise<void> {
  await expectUnobstructed(page.getByText(COPYRIGHT_NOTICE, { exact: false }).filter({ visible: true }).first());
}
