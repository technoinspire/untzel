// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim --gain:
// - gain null test: every instrument alone, its preview at gain 1 and at gain 0.5; the
//   master's RMS must fall 6 ± 0.5 dB (the master never eats a gain change);
// - tone spread: the same at tone 0 and tone 1, before the master; the level may move at
//   most 6 dB (tone changes the colour, not the volume).

import type { InstrumentManifest } from "@untzel/core";
import { failures, runSource } from "../render/run";
import { simRegistry } from "../registry";

const SECONDS = 8;
const BASE_TEXT = "tempo 124\nkey c minor\n";
export const GAIN_STEP_DB = 20 * Math.log10(0.5);
export const GAIN_TOLERANCE_DB = 0.5;
export const TONE_SPREAD_DB = 6;

export interface GainCheck {
  readonly instrument: string;
  /** Master RMS at gain 1 minus at gain 0.5 (expected about 6.02). */
  readonly gainDropDb: number;
  /** Pre-master RMS at tone 1 minus at tone 0. */
  readonly toneSpreadDb: number;
  readonly problems: readonly string[];
}

export function lineOf(manifest: InstrumentManifest, modifier: string): string {
  return `${BASE_TEXT}p: ${manifest.name} ${manifest.preview}${modifier === "" ? "" : ` | ${modifier}`}\n`;
}

/** What the measured drops say against the two rules; empty when both hold. */
export function gainProblems(gainDropDb: number, toneSpreadDb: number): string[] {
  const problems: string[] = [];
  if (Math.abs(gainDropDb + GAIN_STEP_DB) > GAIN_TOLERANCE_DB) problems.push(`gain 0.5 lowers ${gainDropDb.toFixed(2)} dB, not 6.02 ± ${GAIN_TOLERANCE_DB}`);
  if (Math.abs(toneSpreadDb) > TONE_SPREAD_DB) problems.push(`tone moves the level ${toneSpreadDb.toFixed(1)} dB, more than ${TONE_SPREAD_DB}`);
  return problems;
}

export function checkGain(wasm: WebAssembly.Module, now: () => number): number {
  const { instruments } = simRegistry();
  const render = (text: string) => {
    const result = runSource(text, { name: "gain", mode: "loop", seconds: SECONDS, bars: null, tracks: null, seed: null, wasm, calibration: null, now });
    if (!result.ok) throw new Error(`gain: ${result.diagnostics[0]?.message ?? "invalid text"} in ${text}`);
    if (failures(result.report).length > 0) throw new Error(`gain: ${failures(result.report).join("; ")} in ${text}`);
    return result.report;
  };
  const checks: GainCheck[] = instruments.map((manifest) => {
    const full = render(lineOf(manifest, ""));
    const half = render(lineOf(manifest, "gain 0.5"));
    const dark = render(lineOf(manifest, "tone 0"));
    const bright = render(lineOf(manifest, "tone 1"));
    const gainDropDb = (full.audio?.rmsDbfs ?? 0) - (half.audio?.rmsDbfs ?? 0);
    const toneSpreadDb = (bright.trackPreMaster.p?.rmsDbfs ?? 0) - (dark.trackPreMaster.p?.rmsDbfs ?? 0);
    return { instrument: manifest.name, gainDropDb, toneSpreadDb, problems: gainProblems(gainDropDb, toneSpreadDb) };
  });
  console.log(`gain: ${instruments.length} instruments, ${SECONDS} s of the preview each`);
  console.log("instrument   | gain 0.5 drop (dB, master) | tone 0→1 (dB, pre-master) | verdict");
  console.log("------------ | -------------------------- | ------------------------- | -------");
  for (const check of checks) {
    console.log(`${check.instrument.padEnd(12)} | ${check.gainDropDb.toFixed(2).padStart(26)} | ${check.toneSpreadDb.toFixed(2).padStart(25)} | ${check.problems.join("; ") || "ok"}`);
  }
  const failed = checks.filter((check) => check.problems.length > 0);
  if (failed.length > 0) {
    console.error(`sim --gain FAIL: ${failed.length} of ${checks.length} instruments`);
    return 1;
  }
  console.log("sim --gain PASS");
  return 0;
}
