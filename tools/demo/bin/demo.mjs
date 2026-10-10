#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Launcher of the demo tool. Vite's module runner loads the TypeScript sources of the
// workspace as Vite and Vitest do, like tools/sim/bin/sim.mjs (no build step).
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
  write: (text) => process.stdout.write(text),
});
