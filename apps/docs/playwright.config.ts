// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { defineConfig } from "@playwright/test";

// Browser tests of the public docs, run through `pnpm test:browser` (or
// `node tools/docs/bin/docs.mjs browser`), which builds the docs, serves them under
// /docs/ with the production CSP and passes the URL in UNTZEL_DOCS_URL.
// The installed Chrome: Playwright's headless shell fails on this machine.
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.browser.ts",
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    channel: "chrome",
    baseURL: process.env["UNTZEL_DOCS_URL"] ?? "http://127.0.0.1:4180/docs/",
  },
});
