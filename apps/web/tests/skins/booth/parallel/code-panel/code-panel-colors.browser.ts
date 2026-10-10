// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The Code panel reads as our language: every token class has its color, at least 8
// distinct colors in the
// text (fails if the highlighting collapses to one), each track keeps one color in
// the gutter, on its name and on its tile, and every token color is measured from
// screenshots on the panel surface.

import { expect, test } from "@playwright/test";
import { EXPECTED, SURFACE, TRACK_PALETTE, colors, openCode, rgb, trackClasses, type Hooks } from "../../support/code-panel-support";
import { contrast, decodePng, luminance } from "../../../../support/png";
import { addStyleSheet } from "../../../../support/style-sheet-support";
import { collectErrors, expectAttribution, screenshot } from "../../../../support/support";

for (const width of [390, 768, 1024, 1440] as const) {
  test(`code panel highlighting at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await openCode(page, width);
    // Stopped: the sample has one "X", and while playing it may be the sounding token
    // that colors() skips, leaving u-hit-accent without a candidate.
    await page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.stop());
    await expect(page.locator(".u-sounding")).toHaveCount(0);
    const found = await colors(page);
    for (const [name, color] of Object.entries(EXPECTED)) expect(found.byClass[name], name).toBe(color);
    expect(found.distinct, "distinct token colors in the text").toBeGreaterThanOrEqual(8);
    // Keywords in warm white 600, not orange.
    const keywordWeight = await page.locator(".cm-content .u-tok-keyword").first().evaluate((node) => getComputedStyle(node).fontWeight);
    expect(keywordWeight).toBe("600");
    const tracks = await trackClasses(page);
    for (const [name, classes] of Object.entries(tracks)) {
      expect(classes.name, `${name} has a track color`).toMatch(/^u-track-\d$/);
      expect(classes.bar, `${name}: gutter and name share the color`).toBe(classes.name);
      const index = Number(classes.name.slice(-1));
      const color = await page.locator(`.u-track-name.${classes.name}`).first().evaluate((node) => getComputedStyle(node).color);
      expect(color).toBe(rgb(TRACK_PALETTE[index] ?? ""));
    }
    await screenshot(page, "code-panel", width);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}

test("the same text gives every track the same color twice", async ({ page }) => {
  await openCode(page, 1440);
  const first = await trackClasses(page);
  await page.reload();
  await openCode(page, 1440);
  expect(await trackClasses(page)).toEqual(first);
});

test("phone 390: kick's tile dot, gutter bar and name share one color", async ({ page }) => {
  await openCode(page, 390);
  const code = (await trackClasses(page))["kick"];
  expect(code?.bar).toMatch(/^u-track-\d$/);
  await page.locator("#ui-code").getByRole("button", { name: "Close" }).click();
  const dot = page.locator(".ui-tile", { has: page.locator(".ui-tile__name", { hasText: /^kick$/ }) }).locator(".ui-track-dot");
  await expect(dot).toHaveClass(new RegExp(`ui-track-dot--${code?.bar.slice(-1) ?? "x"}\\b`));
  const dotColor = await dot.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(dotColor).toBe(rgb(TRACK_PALETTE[Number(code?.bar.slice(-1))] ?? ""));
});

for (const width of [390, 1440] as const) {
  test(`token colors keep contrast on the panel surface at ${width}`, async ({ page }) => {
    await openCode(page, width);
    // Stopped: the sounding pill would put flare behind a token while sampling.
    await page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.stop());
    await expect(page.locator(".u-sounding")).toHaveCount(0);
    // Each class's own color against the brightest pixel behind its text, in view.
    const results: { name: string; ratio: number }[] = [];
    for (const name of [...Object.keys(EXPECTED), "u-track-name"]) {
      const target = await page.evaluate((className) => {
        const node = document.querySelector(`.cm-content .${className}`);
        if (node === null) return null;
        node.scrollIntoView({ block: "center", inline: "center" });
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        const [r = 0, g = 0, b = 0] = (getComputedStyle(node).color.match(/\d+/g) ?? []).map(Number);
        return { rgb: [r, g, b] as const, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
      }, name);
      if (target === null) continue;
      const removeHiding = await addStyleSheet(page, ".cm-content, .cm-content * { color: transparent !important; text-decoration-color: transparent !important; }");
      const pixels = decodePng(await page.screenshot({ clip: target.box, scale: "css" }));
      await removeHiding();
      let brightest = SURFACE;
      for (let index = 0; index < pixels.data.length; index += 4) {
        brightest = Math.max(brightest, luminance(pixels.data[index] ?? 0, pixels.data[index + 1] ?? 0, pixels.data[index + 2] ?? 0));
      }
      results.push({ name, ratio: Math.round(contrast(luminance(...target.rgb), brightest) * 100) / 100 });
    }
    expect(results).toHaveLength(Object.keys(EXPECTED).length + 1);
    console.log(`code-panel contrast ${width}: ${JSON.stringify(results)}`);
    for (const result of results) expect(result.ratio, result.name).toBeGreaterThanOrEqual(4.5);
  });
}
