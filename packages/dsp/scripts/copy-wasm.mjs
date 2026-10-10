// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Copies the release WASM from the cargo workspace target to packages/dsp/dist/.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  packageDir,
  "../../target/wasm32-unknown-unknown/release/untzel_dsp.wasm",
);
const target = resolve(packageDir, "dist/untzel_dsp.wasm");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`untzel_dsp.wasm: ${statSync(target).size} bytes -> ${target}`);
