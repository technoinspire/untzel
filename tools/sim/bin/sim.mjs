#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Launcher of the headless simulator. Vite's module runner loads the TypeScript sources
// of the workspace as Vite and Vitest do (no build step, no extra dependency); the DSP
// WASM has no imports, so Node instantiates it directly.

import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const { module } = await runnerImport(`${here}../src/cli.ts`, {
  configFile: false,
  root: repo,
  logLevel: "error",
});
process.exitCode = await module.main(process.argv.slice(2), {
  repo,
  wasm: `${repo}packages/dsp/dist/untzel_dsp.wasm`,
});
