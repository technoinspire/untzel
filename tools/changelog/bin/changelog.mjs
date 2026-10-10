#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Launcher of the changelog tool. Vite's module runner loads the TypeScript
// sources as tools/release/bin/release.mjs does: no build step.
//   node tools/changelog/bin/changelog.mjs check [--base <git ref>] [--skip]
//   node tools/changelog/bin/changelog.mjs build --repository <owner/name> --out <file>
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
