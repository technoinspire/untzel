// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Worst-case contrast of text drawn over the light stage.
// For each text element over the stage: hide the text, capture the area behind it in
// many frames while the scene plays, take the brightest pixel seen, and compute the
// WCAG contrast of the text colour against it.
//   node apps/ui-preview/scripts/contrast.mjs
import { chromium } from "@playwright/test";

const base = process.env.PREVIEW_URL ?? "http://localhost:5199/";
const FRAMES = Number(process.env.FRAMES ?? 60);
const cases = [
  { screen: "B", size: [390, 844], selectors: [".ui-topbar__title"] },
  { screen: "E", size: [390, 844], selectors: [".ui-topbar__title"] },
  { screen: "F", size: [390, 844], selectors: [".ui-topbar__title"] },
  { screen: "desktop-track", size: [1440, 900], selectors: [".ui-topbar__title"] },
  { screen: "A", size: [390, 844], selectors: [".ui-topbar__title", ".ui-idle__label", ".ui-idle__sub", ".ui-idle__templates-label", ".ui-idle__hint"] },
  { screen: "A", size: [1440, 900], selectors: [".ui-idle__label", ".ui-idle__sub", ".ui-idle__hint"] },
];

const browser = await chromium.launch({ channel: "chrome" });
const decoder = await browser.newPage();
const results = [];

for (const { screen, size, selectors } of cases) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  await page.goto(`${base}?screen=${screen}&data=wireframe`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  for (const selector of selectors) {
    const color = await page.$eval(selector, (node) => getComputedStyle(node).color);
    const box = await page.$eval(selector, (node) => {
      const r = node.getBoundingClientRect();
      return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    });
    await page.addStyleTag({ content: `${selector} { color: transparent !important; }` });
    let worst = { luminance: 0, rgb: [0, 0, 0] };
    for (let frame = 0; frame < FRAMES; frame += 1) {
      const png = await page.screenshot({ clip: box });
      const brightest = await decoder.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        let best = { luminance: 0, rgb: [0, 0, 0] };
        for (let index = 0; index < pixels.length; index += 4) {
          const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
          const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
          if (luminance > best.luminance) best = { luminance, rgb: [r, g, b] };
        }
        return best;
      }, png.toString("base64"));
      if (brightest.luminance > worst.luminance) worst = brightest;
      await page.waitForTimeout(37);
    }
    const [r, g, b] = color.match(/\d+(\.\d+)?/g).map(Number);
    const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const text = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const [light, dark] = text > worst.luminance ? [text, worst.luminance] : [worst.luminance, text];
    results.push({ screen, width: size[0], selector, text: color, worstBackground: `rgb(${worst.rgb.join(" ")})`, contrast: Number(((light + 0.05) / (dark + 0.05)).toFixed(2)) });
  }
  await page.close();
}

await browser.close();
console.table(results);
