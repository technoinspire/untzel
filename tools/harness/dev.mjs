#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm dev: Vite with HMR for apps/web, plus a Rust watcher. When a Rust source or an
// instrument changes, the instrument index is regenerated, the WASM is rebuilt and the page
// reloads. fs.watch only, no cargo-watch. Ctrl+C stops both.
//   node tools/harness/dev.mjs --smoke   start, load the page, touch a Rust file, expect a
//                                        rebuild and a reload, stop (checks this script)

import { execFileSync } from "node:child_process";
import { readFileSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";
import { REPO } from "./lib.mjs";
import { ensureWasm } from "./wasm.mjs";

const WATCHED = ["packages/dsp/src", "packages/dsp/build.rs", "packages/dsp/Cargo.toml", "instruments"];
const RUST_FILE = /\.(rs|toml|json)$/;
const DEBOUNCE_MS = 200;

async function rebuild(server, onReload) {
  const started = performance.now();
  try {
    // A manifest or a sample pack may have changed: the index is cheap and writes only what
    // changed.
    execFileSync(process.execPath, [join(REPO, "tools/harness/generate-instruments.mjs")], { stdio: "inherit" });
    const { built, detail } = await ensureWasm();
    if (!built) return;
    console.log(`[dsp] ${detail}; reloading (${((performance.now() - started) / 1000).toFixed(1)} s)`);
    server.ws.send({ type: "full-reload" });
    onReload();
  } catch (error) {
    console.error(`[dsp] build failed, the page keeps the previous WASM:\n${error.message ?? error}`);
  }
}

async function main() {
  const smoke = process.argv.includes("--smoke");
  console.log(`[dsp] ${(await ensureWasm()).detail}`);
  const server = await createServer({ root: join(REPO, "apps/web"), server: { port: smoke ? 0 : 5173 } });
  await server.listen();
  server.printUrls();
  let timer = null;
  let running = Promise.resolve();
  let reloads = 0;
  const schedule = (file) => {
    if (file !== null && !RUST_FILE.test(String(file))) return;
    clearTimeout(timer);
    timer = setTimeout(() => (running = running.then(() => rebuild(server, () => (reloads += 1)))), DEBOUNCE_MS);
  };
  const watchers = WATCHED.map((path) => watch(join(REPO, path), { recursive: true }, (_event, file) => schedule(file)));
  console.log(`[dsp] watching ${WATCHED.join(", ")}`);
  const stop = async () => {
    for (const watcher of watchers) watcher.close();
    await server.close();
    process.exit(process.exitCode ?? 0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  if (smoke) await smokeTest(server, () => reloads, stop);
}

async function smokeTest(server, reloads, stop) {
  const url = server.resolvedUrls?.local[0] ?? "";
  const page = await fetch(url);
  const file = join(REPO, "packages/dsp/src/math.rs");
  const original = readFileSync(file, "utf8");
  writeFileSync(file, `${original}// dev smoke\n`);
  const deadline = Date.now() + 120_000;
  while (reloads() === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  writeFileSync(file, original);
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 2));
  const ok = page.ok && reloads() > 0;
  console.log(`${ok ? "PASS" : "FAIL"}  dev smoke: page ${page.status}, ${reloads()} reload(s) after a Rust change`);
  if (!ok) process.exitCode = 1;
  await stop();
}

await main();
