#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm doctor: is this machine ready to build, test and simulate Untzel?
// Each check prints how to fix it. Exit 1 when something required is missing.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, toolEnvironment } from "./lib.mjs";

const PNPM = "12.8.1";
const CHROME = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
};

function output(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", env: toolEnvironment(), stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function rustToolchain() {
  const text = readFileSync(join(REPO, "rust-toolchain.toml"), "utf8");
  return /channel\s*=\s*"([^"]+)"/.exec(text)?.[1] ?? "unknown";
}

const checks = [];
const check = (name, level, detail, fix = "") => checks.push({ name, level, detail, fix });

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor === 24) check("Node", "ok", process.version);
else check("Node", "warn", `${process.version}; CI runs 24 (.nvmrc)`, "nvm install 24 && nvm use 24");

const pnpm = output("pnpm", ["--version"]);
if (pnpm === PNPM) check("pnpm", "ok", pnpm);
else check("pnpm", "fail", pnpm === null ? "missing" : `${pnpm}, needs ${PNPM}`, `npm install -g pnpm@${PNPM}  (corepack fails with pnpm 12)`);

const rust = rustToolchain();
const rustc = output("rustc", ["--version"]);
if (rustc?.startsWith(`rustc ${rust} `)) check("Rust", "ok", rustc);
else check("Rust", "fail", rustc === null ? "rustc missing" : `${rustc}, needs ${rust}`, "curl https://sh.rustup.rs -sSf | sh, then: rustup toolchain install (reads rust-toolchain.toml)");

const targets = output("rustup", ["target", "list", "--installed"]);
if (targets?.split("\n").includes("wasm32-unknown-unknown")) check("wasm32 target", "ok", "wasm32-unknown-unknown");
else check("wasm32 target", "fail", targets === null ? "rustup missing" : "not installed", "rustup target add wasm32-unknown-unknown");

const chrome = CHROME[process.platform];
if (chrome !== undefined && existsSync(chrome)) {
  const version = output(chrome, ["--version"]);
  check("Chrome", "ok", version ?? chrome);
} else {
  check("Chrome", "fail", `not found at ${chrome ?? "(unknown platform)"}`, "install Google Chrome; the browser tests use channel \"chrome\" (Playwright's headless shell fails here)");
}

// Only `pnpm demo record` needs ffmpeg: a warning, not a failure.
const ffmpegVersion = output("ffmpeg", ["-hide_banner", "-version"])?.split("\n")[0] ?? null;
const encoders = ffmpegVersion === null ? null : output("ffmpeg", ["-hide_banner", "-encoders"]);
if (ffmpegVersion !== null && encoders !== null && /\blibx264\b/.test(encoders)) check("ffmpeg", "ok", `${ffmpegVersion}, with libx264`);
else check("ffmpeg", "warn", ffmpegVersion === null ? "missing (only pnpm demo record needs it)" : `${ffmpegVersion}, without libx264`, "brew install ffmpeg");
if (existsSync(join(REPO, "node_modules", ".bin", "tsc"))) check("dependencies", "ok", "node_modules present");
else check("dependencies", "fail", "node_modules missing", "pnpm install");

const width = Math.max(...checks.map((entry) => entry.name.length));
for (const entry of checks) {
  const mark = entry.level === "ok" ? "ok  " : entry.level === "warn" ? "warn" : "FAIL";
  console.log(`  ${mark}  ${entry.name.padEnd(width)}  ${entry.detail}`);
  if (entry.level !== "ok" && entry.fix !== "") console.log(`        ${"".padEnd(width)}  fix: ${entry.fix}`);
}
const failed = checks.filter((entry) => entry.level === "fail").length;
const warned = checks.filter((entry) => entry.level === "warn").length;
console.log(`${failed === 0 ? "PASS" : "FAIL"}  doctor: ${checks.length - failed - warned} ok, ${warned} warning(s), ${failed} failure(s)`);
process.exit(failed === 0 ? 0 : 1);
