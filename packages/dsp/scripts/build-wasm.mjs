// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Builds the release WASM. The instruments' voices are included by an absolute #[path]
// (build.rs), and a panic location keeps its file path, so the published WASM would carry
// the build machine's folders. The repository root is remapped to "untzel" for the wasm32
// target only: with --target, cargo gives these flags to the WASM's crates and not to build
// scripts, so the native cargo test and clippy builds keep their cache.
// pnpm build:wasm runs this, and so does tools/harness/wasm.mjs (pnpm check).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// CARGO_ENCODED_RUSTFLAGS separates flags with 0x1f, so a path with spaces stays one flag.
// It wins over RUSTFLAGS, whose flags are carried over.
const SEPARATOR = "\x1f";
const inherited = process.env.CARGO_ENCODED_RUSTFLAGS
  ? process.env.CARGO_ENCODED_RUSTFLAGS.split(SEPARATOR)
  : (process.env.RUSTFLAGS ?? "").split(/\s+/).filter(Boolean);
const flags = [...inherited, `--remap-path-prefix=${repo}=untzel`];

const env = { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join(SEPARATOR) };
delete env.RUSTFLAGS;
const result = spawnSync("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown", "-p", "untzel-dsp"], {
  cwd: repo,
  stdio: "inherit",
  env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
