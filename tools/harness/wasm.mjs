#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Builds the DSP WASM only when its inputs changed, and checks that it imports nothing
// and carries no absolute path of the build
// machine (packages/dsp/scripts/build-wasm.mjs remaps the repository root).
//   node tools/harness/wasm.mjs                 build if the content hash changed
//   node tools/harness/wasm.mjs --force         always build
//   node tools/harness/wasm.mjs --check-imports only check dist (CI, after pnpm build):
//                                               imports and absolute paths

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO, pnpmBin, run } from "./lib.mjs";

export const WASM = join(REPO, "packages/dsp/dist/untzel_dsp.wasm");
const HASH_FILE = join(REPO, ".cache/wasm.hash");
const INPUTS = ["packages/dsp", "instruments", "Cargo.lock", "Cargo.toml", "rust-toolchain.toml"];
const IGNORED = new Set(["dist", "node_modules", "target"]);

function files(path) {
  const absolute = join(REPO, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute)
    .filter((name) => !IGNORED.has(name))
    .sort()
    .flatMap((name) => files(join(path, name)));
}

/** SHA-256 over the path and content of every input, in a stable order. */
export function inputHash() {
  const hash = createHash("sha256");
  for (const file of INPUTS.flatMap(files)) {
    hash.update(relative(REPO, join(REPO, file)));
    hash.update("\0");
    hash.update(readFileSync(join(REPO, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** Throws unless the built WASM has zero imports. */
export function checkImports(path = WASM) {
  const module = new WebAssembly.Module(readFileSync(path));
  const imports = WebAssembly.Module.imports(module);
  if (imports.length > 0) {
    throw new Error(`${relative(REPO, path)} imports ${imports.map((entry) => `${entry.module}.${entry.name}`).join(", ")}`);
  }
  return WebAssembly.Module.exports(module).length;
}

// A home folder on macOS or Linux, or a Windows drive path with at least one folder.
const ABSOLUTE_PATH = /\/Users\/[^\0\s]*|\/home\/[^\0\s]*|\b[A-Za-z]:\\[\w .-]+\\[^\0\s]*/g;
/** The absolute paths in a binary, read as Latin-1 text so every byte is one character. */
export function absolutePaths(bytes) {
  return [...Buffer.from(bytes).toString("latin1").matchAll(ABSOLUTE_PATH)].map((match) => match[0]);
}
/** Throws when the built WASM names a folder of the machine that built it. */
export function checkPaths(path = WASM) {
  const found = absolutePaths(readFileSync(path));
  if (found.length > 0) {
    throw new Error(`${relative(REPO, path)} contains ${found.length} absolute path(s), first ${found[0]}`);
  }
}
/** Imports, then paths; returns the number of exports. */
export function checkWasm(path = WASM) {
  const exports = checkImports(path);
  checkPaths(path);
  return exports;
}
/** Returns { built, detail }. */
export async function ensureWasm({ force = false } = {}) {
  const hash = inputHash();
  const cached = existsSync(HASH_FILE) ? readFileSync(HASH_FILE, "utf8").trim() : null;
  if (!force && cached === hash && existsSync(WASM)) {
    const exports = checkWasm();
    return { built: false, detail: `cached (inputs unchanged), 0 imports, ${exports} exports` };
  }
  const result = await run("build:wasm", pnpmBin, ["run", "build:wasm"]);
  if (!result.ok) throw new Error(result.output);
  const exports = checkWasm();
  mkdirSync(join(REPO, ".cache"), { recursive: true });
  writeFileSync(HASH_FILE, `${hash}\n`);
  return { built: true, detail: `built in ${result.seconds.toFixed(1)} s, 0 imports, ${exports} exports` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    if (process.argv.includes("--check-imports")) {
      const exports = checkWasm();
      console.log(`wasm PASS: ${relative(REPO, WASM)} has 0 imports, ${exports} exports and no absolute path.`);
    } else {
      const { detail } = await ensureWasm({ force: process.argv.includes("--force") });
      console.log(`wasm PASS: ${detail}.`);
    }
  } catch (error) {
    console.error(`wasm FAIL: ${error.message ?? error}`);
    process.exit(1);
  }
}
