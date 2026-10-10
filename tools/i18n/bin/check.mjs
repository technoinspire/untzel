#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Launcher of pnpm i18n:check. Vite's module runner loads the TypeScript catalogs of the
// workspace as the docs generator does (tools/docs/bin/docs.mjs): no build step.
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
