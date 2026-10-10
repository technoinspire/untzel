// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local browser tests (not in CI). Run through `pnpm test:browser`, which
// builds the test bundle, serves it on a free port and passes the URL in UNTZEL_BASE_URL.
// The installed Chrome: Playwright's headless shell fails on this machine.
//
// Three Chrome projects, run one after the other by the harness, in this order:
// "chrome" in parallel; "timing" one test at a time, the tests that sample time (top bar
// and transport contrast over 48 tracks, sheet flicks), before any export; and "solo" one
// test at a time, the exports, whose renders saturate the CPU and GPU and whose story
// time is measured on an otherwise idle machine, and the scene tests that replay the light
// into the export's stage (flash-sum, scene-captures), as heavy on the GPU. A timing test never runs beside or right
// after a render: the flick failed after the exports and passed alone.
// `--engines` adds WebKit and Firefox for the codec paths and the static CSP.
// Each project runs its folder of the suite of the skin the composition builds:
// tests/skins/<skin>/<project>/, plus tests/app/<project>/ for a test that reads no skin's
// markup. The skin is the one the alias line of package.json names.
const SKIN_ALIAS = /^workspace:@untzel\/skin-([a-z0-9-]+)@\*$/;
const alias = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> }).dependencies["@untzel/skin"] ?? "";
const skin = SKIN_ALIAS.exec(alias)?.[1];
if (skin === undefined) throw new Error(`apps/web/package.json: "@untzel/skin" must be workspace:@untzel/skin-<name>@*, not "${alias}"`);
const suite = (project: string): string[] => [`skins/${skin}/${project}/**/*.browser.ts`, `app/${project}/**/*.browser.ts`];
// The static CSP test also runs in WebKit and Firefox.
const STATIC_CSP_TEST = `skins/${skin}/parallel/page/static-csp.browser.ts`;
const engines = process.env["UNTZEL_ENGINES"] === "1";
const chrome = {
  channel: "chrome",
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
};

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.browser.ts",
  fullyParallel: true,
  // UNTZEL_BROWSER_WORKERS=1 for a loaded machine.
  workers: Number(process.env["UNTZEL_BROWSER_WORKERS"] ?? 4),
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    // The interface follows navigator.languages: every test reads English unless it picks.
    locale: "en-US",
    baseURL: process.env["UNTZEL_BASE_URL"] ?? "http://127.0.0.1:4173/",
  },
  projects: [
    { name: "chrome", testMatch: suite("parallel"), use: chrome },
    { name: "timing", testMatch: suite("timing"), workers: 1, use: chrome },
    { name: "solo", testMatch: suite("solo"), workers: 1, use: chrome },
    ...(engines
      ? [
          { name: "webkit", testMatch: [...suite("cross-browser"), STATIC_CSP_TEST], workers: 1, use: { ...devices["Desktop Safari"] } },
          { name: "firefox", testMatch: [...suite("cross-browser"), STATIC_CSP_TEST], workers: 1, use: { ...devices["Desktop Firefox"] } },
        ]
      : []),
  ],
});
