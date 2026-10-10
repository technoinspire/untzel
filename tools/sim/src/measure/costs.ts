// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim --costs: in one process and
// interleaved, N renders of the empty engine and N of every instrument alone playing
// its preview in a loop for 8 s. Cost per voice = (median of the instrument − median of
// the empty engine) ÷ the instrument's voiceFrames, normalised by the kick measured in
// the same run. Prints the table and writes .cache/sim/costs.json. Reports only: the
// ±25% comparison with the manifests is a review step, not a gate.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { failures, runSource } from "../render/run";
import { simRegistry } from "../registry";

const SECONDS = 8;
/** Copies of the instrument per render, so its cost stands above the timing noise. */
export const COPIES = 8;
const TOLERANCE = 0.25;
const BASE_TEXT = "tempo 124\nkey c minor\n";

export interface InstrumentCost {
  readonly name: string;
  readonly engine: string;
  readonly manifest: number;
  /** Units of the meter (kick = 1). */
  readonly measured: number;
  /** Milliseconds of DSP per million voice frames. */
  readonly msPerMegaVoiceFrame: number;
  readonly averageVoices: number;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export function previewText(name: string, preview: string): string {
  const lines = Array.from({ length: COPIES }, (_, index) => `p${index + 1}: ${name} ${preview}`);
  return `${BASE_TEXT}${lines.join("\n")}\n`;
}

// Over 40 lines: the --costs measurement and its table, in the order the command prints them.
export function measureCosts(repo: string, wasm: WebAssembly.Module, rounds: number, now: () => number): number {
  const { instruments } = simRegistry();
  const run = (source: string) => {
    const result = runSource(source, { name: "costs", mode: "loop", seconds: SECONDS, bars: null, tracks: null, seed: null, wasm, calibration: null, now });
    if (!result.ok) throw new Error(`costs: ${result.diagnostics[0]?.message ?? "invalid text"} in ${source}`);
    return result;
  };
  run(BASE_TEXT); // warm-up: the first renders pay for the WASM tier-up
  const empty: number[] = [];
  const times = new Map<string, number[]>();
  const voiceFrames = new Map<string, number>();
  let failed = false;
  for (let round = 0; round < rounds; round += 1) {
    empty.push(run(BASE_TEXT).report.render.dspMs);
    for (const manifest of instruments) {
      const result = run(previewText(manifest.name, manifest.preview));
      times.set(manifest.name, [...(times.get(manifest.name) ?? []), result.report.render.dspMs]);
      const frames = (result.run.stats?.instances ?? []).filter((entry) => /^p\d+$/.test(entry.name)).reduce((sum, entry) => sum + entry.voiceFrames, 0);
      voiceFrames.set(manifest.name, frames);
      failed ||= failures(result.report).length > 0;
    }
  }
  const emptyMs = median(empty);
  const perVoiceFrame = (name: string): number => {
    const frames = voiceFrames.get(name) ?? 0;
    return frames > 0 ? Math.max(0, median(times.get(name) ?? []) - emptyMs) / frames : 0;
  };
  const kick = perVoiceFrame("kick");
  const costs: InstrumentCost[] = instruments.map((manifest) => ({
    name: manifest.name,
    engine: manifest.engine,
    manifest: manifest.costPerVoice,
    measured: kick > 0 ? perVoiceFrame(manifest.name) / kick : 0,
    msPerMegaVoiceFrame: perVoiceFrame(manifest.name) * 1e6,
    averageVoices: (voiceFrames.get(manifest.name) ?? 0) / (SECONDS * 48_000 * COPIES),
  }));
  console.log(`costs: ${instruments.length} instruments, median of ${rounds} rounds of ${SECONDS} s, empty engine ${emptyMs.toFixed(1)} ms`);
  console.log("instrument   | engine     | manifest | measured | ratio | voices | ms/Mvf");
  console.log("------------ | ---------- | -------- | -------- | ----- | ------ | ------");
  let outside = 0;
  for (const cost of costs) {
    const ratio = cost.manifest > 0 ? cost.measured / cost.manifest : 0;
    const off = Math.abs(ratio - 1) > TOLERANCE;
    if (off) outside += 1;
    console.log(
      `${cost.name.padEnd(12)} | ${cost.engine.padEnd(10)} | ${cost.manifest.toFixed(2).padStart(8)} | ${cost.measured.toFixed(2).padStart(8)} | ${ratio.toFixed(2).padStart(5)} | ${cost.averageVoices.toFixed(2).padStart(6)} | ${cost.msPerMegaVoiceFrame.toFixed(2).padStart(6)}${off ? "  outside ±25%" : ""}`,
    );
  }
  console.log(`${outside} of ${costs.length} outside ±${TOLERANCE * 100}% of the manifest`);
  const dir = join(repo, ".cache", "sim");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "costs.json"), `${JSON.stringify({ rounds, seconds: SECONDS, emptyMs, costs }, null, 2)}\n`);
  console.log(`→ ${join(dir, "costs.json")}`);
  if (failed) {
    console.error("sim --costs FAIL: a preview had NaN or a peak above 0 dBFS");
    return 1;
  }
  return 0;
}
