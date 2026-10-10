#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Launcher of the docs generator. Vite's module runner loads the TypeScript sources of the
// workspace as the simulator does (tools/sim/bin/sim.mjs): no build step, no extra dependency.
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const { module } = await runnerImport(`${here}../src/cli.ts`, {
  configFile: false,
  root: repo,
  logLevel: "error",
});
process.exitCode = await module.main(process.argv.slice(2), { repo });
