// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Full-page captures of every preview screen with the installed Chrome. Run with the dev server up:
//   node apps/ui-preview/scripts/capture.mjs [outDir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.PREVIEW_URL ?? "http://localhost:5199/";
const outDir = process.argv[2] ?? "/tmp/untzel-ui-shots";
mkdirSync(outDir, { recursive: true });

const screens = ["A", "B", "C", "D", "E", "F", "G", "desktop-track", "desktop-code", "collapsed", "collapsed-code", "desktop-collapsed", "length", "part", "desktop-song", "load-failed", "unsupported"];
const sizes = { mobile: [390, 844], desktop: [1440, 900] };
const extraTracks = { tablet: [768, 1024], laptop: [1024, 768] };

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

async function shoot(name, url, [width, height], { fullPage = true, wait = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${name}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage });
  const renderer = await page.evaluate(() => document.documentElement.dataset.renderer ?? "none");
  await page.close();
  return renderer;
}

const renderers = new Set();
for (const screen of screens) {
  for (const [label, size] of Object.entries(sizes)) {
    renderers.add(await shoot(`${screen}-${label}`, `${base}?screen=${screen}&data=wireframe&still=1`, size));
  }
}
for (const [label, size] of Object.entries(extraTracks)) {
  await shoot(`B-${label}`, `${base}?screen=B&data=wireframe&still=1`, size);
}
for (const screen of ["B", "D", "E", "F"]) {
  await shoot(`${screen}-mobile-phase1`, `${base}?screen=${screen}&still=1`, sizes.mobile);
}

await browser.close();
console.log(JSON.stringify({ outDir, renderers: [...renderers], consoleErrors: errors }, null, 2));
