#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Launcher of the release tool. Vite's module runner
// loads the TypeScript sources as tools/i18n/bin/check.mjs does: no build step.
//   node tools/release/bin/release.mjs version --tag vX.Y.Z --source tag|rehearsal
//   node tools/release/bin/release.mjs package --tag vX.Y.Z --commit <sha> --created-at <iso>
//     --repository <owner/name> --app apps/web/dist --docs apps/web/dist/docs --out .cache/release
//   node tools/release/bin/release.mjs rehearsal-notice --manifest .cache/release/untzel-0.0.0.manifest.json
//     --run-id <id> --ref refs/heads/<branch> --repository <owner/name> --out .cache/release/untzel-0.0.0.rehearsal.json
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
