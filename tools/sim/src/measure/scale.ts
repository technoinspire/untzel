// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm sim --scale: the meter's estimate against the measured render.
// 1. The base lines: 1 to 64 tracks of kick, hat, bass.
// 2. One line per engine: 8 tracks of the
//    engine's most expensive instrument.
// 3. STRESS CHECK, the library stress song: one track of every instrument at
//    once — a synthetic worst case no real track hits — within 14% of real time. It fails
//    the command; the tolerance lines are reported. It is a stress check, not a device
//    budget: the per-template budgets (the real tracks) gate a real device; this song
//    only guards the shared engines.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Calibration } from "@untzel/audio/main";
import type { SimulationReport } from "../render/report";
import { failures, runSource } from "../render/run";
import { simRegistry } from "../registry";
import { ENGINE_TRACKS, engineRepresentatives, instrumentStressSource, stressSource } from "../stress";

export const SCALE_TRACKS = [1, 8, 16, 32, 64] as const;
export { ENGINE_TRACKS };
export const LIBRARY_FILE = "tools/sim/fixtures/library.untzel";
/**
 * STRESS CHECK: the stress-song gate, not a device budget. A 6% target
 * was never verified; measured on a calm Mac with `--clock cpu` the song is 9.82–9.89%
 * of real time (the insert chains ~13% of that, the 44 voices ~86%), and the hot loops
 * are already optimized. 12% kept the music and all 44 instruments. The sound-design work
 * widened the default pads, strings, brass, leads and supersaw into stereo fans,
 * which costs 12.4–12.7% on the same calm Mac; the gate moves to 14%, not the width.
 */
export const LIBRARY_BUDGET = 0.14;
const SCALE_SECONDS = 10;

export interface ScaleOptions {
  readonly repo: string;
  readonly wasm: WebAssembly.Module;
  readonly calibration: Calibration;
  readonly now: () => number;
}

/** The scale test's tolerance: 15% relative, or 0.015 absolute below 0.1. */
export function withinDesignTolerance(measured: number, estimated: number): boolean {
  const difference = Math.abs(estimated - measured);
  return measured < 0.1 ? difference <= 0.015 || difference <= 0.15 * measured : difference <= 0.15 * measured;
}

interface Line {
  readonly label: string;
  readonly report: SimulationReport;
}

class ScaleTable {
  worst = 0;
  outside = 0;
  rows = 0;
  failed = false;

  header(title: string): void {
    console.log(`\n${title}`);
    console.log("line                   | dsp ms / 10 s | measured load | estimated load | error  | tick ms | NaN | peak dBFS");
    console.log("---------------------- | ------------- | ------------- | -------------- | ------ | ------- | --- | ---------");
  }

  add({ label, report }: Line): void {
    const measured = report.render.realtimeFactor;
    const estimated = report.estimatedLoad ?? 0;
    const error = (estimated - measured) / measured;
    this.rows += 1;
    this.worst = Math.max(this.worst, Math.abs(error));
    const within = withinDesignTolerance(measured, estimated);
    if (!within) this.outside += 1;
    this.failed ||= failures(report).length > 0;
    const peak = report.audio?.peakDbfs;
    console.log(
      `${label.padEnd(22)} | ${report.render.dspMs.toFixed(0).padStart(13)} | ${measured.toFixed(4).padStart(13)} | ${estimated.toFixed(4).padStart(14)} | ${`${(error * 100).toFixed(1)}%`.padStart(6)} | ${report.render.transportMsPerTick.toFixed(3).padStart(7)} | ${String(report.audio?.nonFinite ?? 0).padStart(3)} | ${(peak === null || peak === undefined ? "–" : peak.toFixed(2)).padStart(9)}${within ? "" : "  outside"}`,
    );
  }
}

function render(source: string, name: string, options: ScaleOptions): SimulationReport | null {
  const result = runSource(source, { name, mode: "loop", seconds: SCALE_SECONDS, bars: null, tracks: null, seed: null, wasm: options.wasm, calibration: options.calibration, now: options.now });
  return result.ok ? result.report : null;
}

export function runScale(options: ScaleOptions): number {
  const { instruments } = simRegistry();
  const { calibration } = options;
  console.log(`calibration: fixed ${calibration.fixedFraction.toFixed(5)} · per unit ${calibration.fractionPerUnit.toFixed(6)} (fraction of real time, this machine, Node)`);
  const table = new ScaleTable();
  table.header("kick, hat, bass alternating");
  for (const count of SCALE_TRACKS) {
    const report = render(stressSource(instruments, count), `scale-${count}`, options);
    if (report === null) return 2;
    table.add({ label: `${count} tracks`, report });
  }
  table.header(`one line per engine: ${ENGINE_TRACKS} tracks of its most expensive instrument`);
  for (const instrument of engineRepresentatives(instruments)) {
    const report = render(instrumentStressSource(instrument, ENGINE_TRACKS), `scale-${instrument.name}`, options);
    if (report === null) return 2;
    table.add({ label: `${instrument.engine} (${instrument.name})`, report });
  }
  table.header("STRESS CHECK, library stress song: every instrument at once (synthetic worst case)");
  const library = render(readFileSync(join(options.repo, LIBRARY_FILE), "utf8"), "scale-library", options);
  if (library === null) return 2;
  table.add({ label: `library (${instruments.length})`, report: library });
  console.log(
    `\nworst relative error ${(table.worst * 100).toFixed(1)}%; ${table.outside} of ${table.rows} lines outside the design tolerance (15% relative, or 0.015 absolute below 0.1)`,
  );
  const libraryLoad = library.render.realtimeFactor;
  console.log(`library stress song: ${(libraryLoad * 100).toFixed(2)}% of real time (budget ${Math.round(LIBRARY_BUDGET * 100)}%)`);
  if (table.failed) {
    console.error("sim --scale FAIL: a run had NaN or a peak above 0 dBFS");
    return 1;
  }
  if (libraryLoad > LIBRARY_BUDGET) {
    console.error(`sim --scale FAIL: the library stress song takes ${(libraryLoad * 100).toFixed(2)}% of real time, over ${Math.round(LIBRARY_BUDGET * 100)}%`);
    return 1;
  }
  console.log("sim --scale PASS");
  return 0;
}
