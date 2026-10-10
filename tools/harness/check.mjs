#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm check            fast local gate: types, unit tests, Rust tests, layer rules, docs,
//                       translations, headers
// pnpm check --changed  only what the changes since main touch
// pnpm check:full       check, then build (app and docs), budgets, golden files, simulator
//                       (templates, cookbook and AI examples of the docs), instrument levels,
//                       the timbre gate and browser tests
// Run `pnpm check` before pushing (CONTRIBUTING.md, Checks).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO, nodeBin, pnpmBin, run, skipped, step, summarize } from "./lib.mjs";
import { CRUISE_TARGETS } from "./cruise-targets.mjs";
import { ensureWasm } from "./wasm.mjs";

const args = new Set(process.argv.slice(2));
const changedOnly = args.has("--changed");
const full = args.has("--full");
const startedAt = performance.now();
const bin = (name) => join(REPO, "node_modules", ".bin", name);

/** Files changed against main: commits on this branch plus the working tree. */
function changedFiles() {
  const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: REPO, encoding: "utf8" });
  let base = "main";
  try {
    base = git("merge-base", "main", "HEAD").trim();
  } catch {
    // no main locally: compare with HEAD only
    base = "HEAD";
  }
  const committed = git("diff", "--name-only", base, "HEAD").split("\n");
  const working = git("status", "--porcelain", "--untracked-files=all")
    .split("\n")
    .map((line) => line.slice(3).split(" -> ").at(-1) ?? "");
  return [...new Set([...committed, ...working])].filter((file) => file !== "");
}

/**
 * The cookbook and AI examples of the public docs, 16 bars in loop mode, and in song mode
 * when they have a song: code people copy into the app must sound.
 */
const DOCS_EXAMPLES = "apps/docs/examples";
const DOCS_SIM_EXAMPLES = readdirSync(join(REPO, DOCS_EXAMPLES))
  .filter((file) => /^(cookbook|ai)-.+\.untzel$/.test(file))
  .sort()
  .flatMap((file) => {
    const path = `${DOCS_EXAMPLES}/${file}`;
    const loop = { label: `docs ${file}`, args: [path, "--bars", "16"] };
    const hasSong = /^song\s/m.test(readFileSync(join(REPO, path), "utf8"));
    return hasSong ? [loop, { label: `docs ${file} song`, args: [path, "--bars", "16", "--mode", "song"] }] : [loop];
  });
const RUST = /^(packages\/dsp\/|instruments\/|Cargo\.(toml|lock)$|rust-toolchain\.toml$)/;

async function generate() {
  const grammar = join(REPO, "packages/language/src/untzel.grammar");
  const parser = join(REPO, "packages/language/src/generated/parser.ts");
  if (existsSync(parser) && statSync(parser).mtimeMs >= statSync(grammar).mtimeMs) {
    // The parser is fresh; the instrument index is cheap and writes only what changed.
    return run("generate", nodeBin, ["tools/harness/generate-instruments.mjs"]);
  }
  return run("generate", pnpmBin, ["run", "generate"]);
}

async function main() {
  const changed = changedOnly ? changedFiles() : null;
  const rustChanged = changed === null || changed.some((file) => RUST.test(file));
  const results = [await generate()];
  results.push(
    await step("wasm", async () => (await ensureWasm()).detail),
  );
  const group = [
    run("typecheck", bin("tsc"), ["-b"]),
    run("unit", bin("vitest"), ["run", ...(changed === null ? [] : ["--changed", "main"])]),
    rustChanged ? run("rust", "cargo", ["test", "-p", "untzel-dsp", "--quiet"]) : Promise.resolve(skipped("rust", "no Rust change since main")),
    run("deps", bin("depcruise"), [...CRUISE_TARGETS, "--config", ".dependency-cruiser.cjs"]),
    run("layout", nodeBin, ["tools/harness/check-layout.mjs"]),
    run("docs", nodeBin, ["tools/docs/bin/docs.mjs", "check"]),
    run("i18n", nodeBin, ["tools/i18n/bin/check.mjs"]),
    run("headers", nodeBin, ["tools/headers/check-headers.mjs"]),
  ];
  results.push(...(await Promise.all(group)));
  if (full && results.every((result) => result.ok)) {
    results.push(await run("rust-lint", "cargo", ["clippy", "--all-targets", "--quiet", "--", "-D", "warnings"]));
    results.push(await run("rust-fmt", "cargo", ["fmt", "--check"]));
    results.push(await run("build", pnpmBin, ["--filter", "@untzel/web", "build"]));
    results.push(await run("build docs", nodeBin, ["tools/docs/bin/docs.mjs", "build", "--out", "apps/web/dist/docs"]));
    results.push(await run("budgets", nodeBin, ["tools/budgets/check-budgets.mjs", "apps/web/dist"]));
    results.push(await run("golden", nodeBin, ["tools/sim/bin/sim.mjs", "--golden"]));
    results.push(await run("sim midnight-bloom", nodeBin, ["tools/sim/bin/sim.mjs", "melodic-techno/midnight-bloom"]));
    results.push(await run("sim levels", nodeBin, ["tools/sim/bin/sim.mjs", "--levels"]));
    results.push(await run("sim gain", nodeBin, ["tools/sim/bin/sim.mjs", "--gain"]));
    results.push(await run("sim timbre", nodeBin, ["tools/sim/bin/sim.mjs", "--timbre", "--fail-closed"]));
    // 240 units: with the measured costPerVoice the 64 pianos take ~600 units,
    // so the device is ~2.5x overloaded, the load the protection is checked against.
    results.push(await run("sim capacity", nodeBin, ["tools/sim/bin/sim.mjs", "--capacity", "240"]));
    for (const example of DOCS_SIM_EXAMPLES) results.push(await run(`sim ${example.label}`, nodeBin, ["tools/sim/bin/sim.mjs", ...example.args]));
    results.push(await run("browser", nodeBin, ["tools/harness/browser.mjs"]));
  }
  const title = full ? "pnpm check:full" : changedOnly ? "pnpm check --changed" : "pnpm check";
  process.exit(summarize(title, results, startedAt));
}

await main();
