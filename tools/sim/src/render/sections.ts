// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim <file> --section <name|all>: renders a section as if it were the loop section
// and reports its real-time factor (median of N rounds), the CPU budget check of the
// onboard (factor × 4 ≤ 0.35, the 35% of the quantum with the assumed phone
// factor) and the factor × 6 for reference.

import type { Calibration } from "@untzel/audio/main";
import { failures, runSource } from "./run";

export interface SectionOptions {
  readonly bars: number;
  readonly rounds: number;
  readonly wasm: WebAssembly.Module;
  readonly calibration: Calibration;
  readonly now: () => number;
}

/** The phone is assumed this many times slower than this Mac. */
export const PHONE_FACTOR = 4;
export const PHONE_FACTOR_HIGH = 6;
/** 35% of the render quantum on a mid-range phone. */
export const QUANTUM_BUDGET = 0.35;

const SECTION_LINE = /^(section\s+)([a-z][a-z0-9-]*)(.*)$/;

/** The text with `| loop` on `target` only. */
export function withLoopSection(source: string, target: string): string {
  return source
    .split("\n")
    .map((line) => {
      const match = SECTION_LINE.exec(line);
      if (match === null) return line;
      const [, head = "", name = "", rest = ""] = match;
      const withoutLoop = rest.replace(/\s*\|\s*loop\b/, "");
      return name === target ? `${head}${name}${withoutLoop} | loop` : `${head}${name}${withoutLoop}`;
    })
    .join("\n");
}

export function sectionNames(source: string): string[] {
  return source
    .split("\n")
    .map((line) => SECTION_LINE.exec(line)?.[2])
    .filter((name): name is string => name !== undefined);
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export interface SectionCost {
  readonly section: string;
  readonly tracks: number;
  readonly realtimeFactor: number;
  readonly peakDbfs: number | null;
  readonly failures: readonly string[];
}

export function measureSection(source: string, name: string, section: string, options: SectionOptions): SectionCost | null {
  const text = withLoopSection(source, section);
  const factors: number[] = [];
  let last = null;
  for (let round = 0; round < options.rounds; round += 1) {
    const result = runSource(text, { name: `${name}-${section}`, mode: "loop", seconds: null, bars: options.bars, tracks: null, seed: null, wasm: options.wasm, calibration: options.calibration, now: options.now });
    if (!result.ok) return null;
    factors.push(result.report.render.realtimeFactor);
    last = result;
  }
  if (last === null) return null;
  const members = last.program.sections.find((entry) => entry.name === section)?.tracks.length ?? 0;
  return {
    section,
    tracks: members,
    realtimeFactor: median(factors),
    peakDbfs: last.report.audio?.peakDbfs ?? null,
    failures: failures(last.report),
  };
}

export function runSections(source: string, name: string, which: string, options: SectionOptions): number {
  const names = which === "all" ? sectionNames(source) : [which];
  if (names.length === 0 || names.some((section) => !sectionNames(source).includes(section))) {
    console.error(`sim: no section ${which} in ${name}`);
    return 2;
  }
  const costs: SectionCost[] = [];
  for (const section of names) {
    const cost = measureSection(source, name, section, options);
    if (cost === null) {
      console.error(`sim: ${name} does not analyze`);
      return 2;
    }
    costs.push(cost);
  }
  const heaviest = costs.reduce((worst, cost) => (cost.realtimeFactor > worst.realtimeFactor ? cost : worst));
  console.log(`${name}: ${options.bars} bars per section, median of ${options.rounds} rounds (fraction of real time on this machine)`);
  console.log("section    | tracks | factor | × 4    | × 6    | peak dBFS");
  console.log("---------- | ------ | ------ | ------ | ------ | ---------");
  for (const cost of costs) {
    const mark = cost === heaviest ? " ← heaviest" : "";
    console.log(
      `${cost.section.padEnd(10)} | ${String(cost.tracks).padStart(6)} | ${cost.realtimeFactor.toFixed(4)} | ${(cost.realtimeFactor * PHONE_FACTOR).toFixed(4)} | ${(cost.realtimeFactor * PHONE_FACTOR_HIGH).toFixed(4)} | ${cost.peakDbfs?.toFixed(2) ?? "–"}${mark}`,
    );
  }
  const failed = costs.filter((cost) => cost.failures.length > 0);
  for (const cost of failed) console.error(`sim FAIL: ${cost.section}: ${cost.failures.join("; ")}`);
  const budget = heaviest.realtimeFactor * PHONE_FACTOR;
  const within = budget <= QUANTUM_BUDGET;
  console.log(`heaviest ${heaviest.section}: × ${PHONE_FACTOR} = ${budget.toFixed(4)} ${within ? "≤" : ">"} ${QUANTUM_BUDGET}`);
  if (failed.length > 0 || !within) return 1;
  console.log("sim --section PASS");
  return 0;
}
