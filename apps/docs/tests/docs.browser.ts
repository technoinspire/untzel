// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The public docs in the installed Chrome, served under /docs/ with the production
// CSP: every page in both languages at 390 × 844 and 1440 × 900, then the interactions.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { collectErrors, expectAttribution, screenshot, VIEWPORTS, type ViewportWidth } from "../../web/tests/support/support";

const PAGES = ["", "app/", "language/", "reference/", "instruments/", "cookbook/", "ai/", "developers/", "status/"] as const;
const LOCALES = [
  { locale: "pt-BR", prefix: "" },
  { locale: "en", prefix: "en/" },
] as const;
/** Every page is checked (structure, contrast, targets, console) and captured at each of these. */
const WIDTHS: readonly ViewportWidth[] = [390, 768, 1024, 1440];
/** One JSON per page and width with the measured minimum contrast, for the verification report. */
const MEASUREMENTS = join(process.cwd(), "../../.cache/measurements/docs-contrast");

function stateName(prefix: string, path: string): string {
  return `docs-${prefix === "" ? "pt" : "en"}-${path === "" ? "start" : path.replace(/\/$/, "")}`;
}

/** Smallest contrast of every visible text node against its composed background. */
async function minimumContrast(page: Page): Promise<{ ratio: number; where: string }> {
  return page.evaluate(() => {
    const parse = (value: string): [number, number, number, number] => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const luminance = ([r, g, b]: readonly number[]): number => {
      const channel = (c: number): number => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
    };
    const background = (node: Element): [number, number, number] => {
      const layers: [number, number, number, number][] = [];
      for (let current: Element | null = node; current !== null; current = current.parentElement) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 1) break;
      }
      let result: [number, number, number] = [11, 11, 12];
      for (const [r, g, b, a] of layers.reverse()) result = [r * a + result[0] * (1 - a), g * a + result[1] * (1 - a), b * a + result[2] * (1 - a)];
      return result;
    };
    let worst = { ratio: 99, where: "" };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const element = text.parentElement;
      if (element === null || (text.textContent ?? "").trim() === "") continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width === 0 || rect.height === 0 || style.visibility !== "visible" || element.closest("[hidden], .visually-hidden, .skip-link") !== null) continue;
      const foreground = parse(style.color);
      const back = background(element);
      const blended = [0, 1, 2].map((i) => (foreground[i] ?? 0) * foreground[3] + back[i]! * (1 - foreground[3]));
      const [high, low] = [luminance(blended), luminance(back)].sort((a, b) => b - a);
      const ratio = ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
      if (ratio < worst.ratio) worst = { ratio, where: `${element.tagName}.${element.className}: ${(text.textContent ?? "").trim().slice(0, 40)}` };
    }
    return worst;
  });
}

async function headingProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((node) => Number(node.tagName.slice(1)));
    const problems: string[] = [];
    if (levels.filter((level) => level === 1).length !== 1) problems.push("needs exactly one h1");
    levels.forEach((level, index) => {
      if (level > (levels[index - 1] ?? 0) + 1) problems.push(`h${level} after h${levels[index - 1] ?? 0}`);
    });
    return problems;
  });
}

/** Interactive elements outside running text must be at least 44 px high. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".masthead a, .masthead button, .masthead input, .menu__list a, .menu__toggle, .copy, .pager a, .footer a, .untzel-lang a")]
      .filter((node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height < 44)
      .map((node) => `${node.tagName}.${node.className} ${Math.round(node.getBoundingClientRect().height)}px`),
  );
}

for (const width of WIDTHS) {
  for (const { locale, prefix } of LOCALES) {
    for (const path of PAGES) {
      test(`${locale} /${prefix}${path} at ${width}`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.setViewportSize(VIEWPORTS[width]);
        await page.goto(`${prefix}${path}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expectAttribution(page);
        expect(await headingProblems(page)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
        const appHref = await page.locator("a[data-app-link]").evaluate((link) => (link as HTMLAnchorElement).href);
        expect(appHref).toBe("https://app.untzel.com/");
        const contrast = await minimumContrast(page);
        mkdirSync(MEASUREMENTS, { recursive: true });
        writeFileSync(join(MEASUREMENTS, `${stateName(prefix, path)}-${width}.json`), `${JSON.stringify(contrast)}\n`);
        expect(contrast.ratio, contrast.where).toBeGreaterThanOrEqual(4.5);
        expect(await smallTargets(page)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const { prefix } of LOCALES) {
  for (const path of PAGES) {
    test(`capture /${prefix}${path}`, async ({ page }) => {
      const errors = collectErrors(page);
      for (const width of WIDTHS) {
        await page.setViewportSize(VIEWPORTS[width]);
        await page.goto(`${prefix}${path}`);
        await page.evaluate(() => document.fonts.ready);
        await screenshot(page, stateName(prefix, path), width);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("the skip link is the first focusable element and moves focus to main", async ({ page }) => {
  await page.goto("language/");
  await page.keyboard.press("Tab");
  const skip = page.locator(".skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  const outline = await skip.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineOffset}`;
  });
  expect(outline).toBe("solid 2px 3px");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("the copy button copies the whole prompt", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("en/ai/");
  const button = page.locator('button[data-copy="ai-prompt"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toContainText("Copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const shown = await page.locator("#ai-prompt").textContent();
  expect(copied).toBe(shown);
  expect(copied.length).toBeGreaterThan(5000);
});

test("the language switch keeps the section", async ({ page }) => {
  await page.goto("language/#signals");
  await page.locator('a[data-locale-link="en"]').first().click();
  await expect(page).toHaveURL(/\/docs\/en\/language\/#signals$/);
  await expect(page.locator("#signals")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const saved = await page.evaluate(() => localStorage.getItem("untzel.locale"));
  expect(saved).toBe("en");
});

test("search finds a section and links to it", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto("en/");
  const input = page.locator("#search-input");
  await expect(input).toBeVisible();
  await input.fill("signals");
  const first = page.locator(".search__results a").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/#signals$|#values$|signals/);
  expect(errors).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every page is complete and the prompt is selectable text", async ({ page }) => {
    for (const { prefix } of LOCALES) {
      for (const path of PAGES) {
        await page.goto(`${prefix}${path}`);
        await expect(page.locator("main h1")).toHaveCount(1);
        await expect(page.locator(".copy").first()).toBeHidden();
        await expect(page.locator("[data-search]")).toBeHidden();
      }
    }
    await page.goto("ai/");
    const prompt = await page.locator("#ai-prompt").textContent();
    expect(prompt?.length ?? 0).toBeGreaterThan(5000);
    await page.goto("language/");
    await expect(page.locator('a[data-locale-link="en"]').first()).toHaveAttribute("href", "../en/language/");
  });
});
