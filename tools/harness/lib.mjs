// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Shared pieces of the local harness: running steps with a
// timing, and a one-screen pass/fail summary. Node only, no dependency.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("../../", import.meta.url));

/** cargo and rustup live in ~/.cargo/bin when the shell profile was not sourced. */
export function toolEnvironment(extra = {}) {
  const cargoBin = join(homedir(), ".cargo", "bin");
  const path = process.env.PATH ?? "";
  const withCargo = existsSync(cargoBin) && !path.split(delimiter).includes(cargoBin) ? `${cargoBin}${delimiter}${path}` : path;
  return { ...process.env, PATH: withCargo, FORCE_COLOR: process.env.FORCE_COLOR ?? "1", ...extra };
}

/**
 * Runs a command. Output is buffered and printed only on failure (or always with
 * `stream: true`), so a parallel group stays readable.
 */
export function run(label, command, args, { cwd = REPO, env = {}, stream = false, cleanEnv = false } = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    // cleanEnv: only `env` (Playwright's Firefox does not start with this shell's environment).
    const environment = cleanEnv ? env : toolEnvironment(env);
    const child = spawn(command, args, { cwd, env: environment, stdio: stream ? "inherit" : "pipe" });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => {
      resolve({ label, ok: false, seconds: (performance.now() - started) / 1000, output: `${output}${error.message}\n` });
    });
    child.on("close", (code) => {
      resolve({ label, ok: code === 0, seconds: (performance.now() - started) / 1000, output });
    });
  });
}

/** Runs a function as a step (for work done in-process). */
export async function step(label, work) {
  const started = performance.now();
  try {
    const detail = await work();
    return { label, ok: true, seconds: (performance.now() - started) / 1000, output: "", detail };
  } catch (error) {
    return { label, ok: false, seconds: (performance.now() - started) / 1000, output: `${error?.stack ?? error}\n` };
  }
}

export function skipped(label, reason) {
  return { label, ok: true, skipped: true, seconds: 0, output: "", detail: reason };
}

/** Prints failing outputs, then the table; returns the exit code. */
export function summarize(title, results, startedAt) {
  for (const result of results) {
    if (!result.ok && result.output.trim() !== "") {
      console.error(`\n── ${result.label} ─────────────────────────────`);
      console.error(result.output.trimEnd());
    }
  }
  const total = (performance.now() - startedAt) / 1000;
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${title}`);
  for (const result of results) {
    const status = result.skipped ? "skip" : result.ok ? "pass" : "FAIL";
    const detail = result.detail ? `  ${result.detail}` : "";
    console.log(`  ${status.padEnd(4)}  ${result.label.padEnd(22)} ${result.seconds.toFixed(1).padStart(6)} s${detail}`);
  }
  console.log(`${failed.length === 0 ? "PASS" : "FAIL"}  ${results.length - failed.length}/${results.length} steps in ${total.toFixed(1)} s`);
  return failed.length === 0 ? 0 : 1;
}

export const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
export const nodeBin = process.execPath;
