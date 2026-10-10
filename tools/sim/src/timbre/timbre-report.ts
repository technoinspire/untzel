// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm sim --timbre [--fail-closed] [--only a,b] [--out file.json]: the timbre gate. It
// renders the matrix (./timbre-matrix) and, for a full run, the main section of every
// template (./template-identity), writes the JSON and prints what fails.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { identityFailures, measureTemplates, printIdentity, type TemplateIdentity } from "../templates/template-identity";
import { buildMatrix, type TimbreMatrix } from "./timbre-matrix";

export interface TimbreRun {
  readonly repo: string;
  readonly wasm: WebAssembly.Module;
  /** Where the JSON goes. */
  readonly out: string;
  readonly failClosed: boolean;
  /** Instruments to render; null renders all of them and the templates. */
  readonly only: ReadonlySet<string> | null;
}

function printMatrix(matrix: TimbreMatrix): void {
  console.log(
    `timbre: ${matrix.summary.subjects} sounds at ${matrix.sampleRate} Hz · ruler ${matrix.reference.note}→${matrix.reference.shifted} = ${matrix.reference.distance.toFixed(2)}`,
  );
  console.log("sound                    | group   | centroid | attack | decay  | HNR");
  for (const point of matrix.points) {
    console.log(
      `${point.id.padEnd(24)} | ${point.group.padEnd(7)} | ${`${point.centroidHz}`.padStart(8)} | ${point.attackSeconds.toFixed(3).padStart(6)} | ${point.decaySeconds.toFixed(3).padStart(6)} | ${point.harmonicToNoiseDb.toFixed(1).padStart(5)}`,
    );
  }
  console.log("\nb.1 measurements:");
  for (const measure of matrix.spectral) {
    console.log(`  ${measure.target.kind.padEnd(8)} ${measure.target.subject.padEnd(18)} ${measure.values.join(", ").padEnd(28)} ${measure.violation ?? (measure.excepted === true ? "explained (TARGET_EXCEPTIONS)" : "ok")}`);
  }
  console.log("\nlisted pairs:");
  for (const pair of matrix.pairs.filter((entry) => entry.rule === "target")) {
    console.log(`  ${`${pair.a} ~ ${pair.b}`.padEnd(40)} ${pair.render.padEnd(5)} ${pair.distance.toFixed(2).padStart(6)} ≥ ${pair.min}${pair.violation === null ? "" : "  FAIL"}`);
  }
  if (matrix.belowThreshold.length > 0) {
    console.log(`\n${matrix.belowThreshold.length} pair(s) below threshold:`);
    for (const pair of matrix.belowThreshold) {
      console.log(`  ${`${pair.a} ~ ${pair.b}`.padEnd(40)} ${pair.distance.toFixed(2).padStart(6)}  ${pair.rule}: ${pair.violation ?? ""}`);
    }
  }
  const { summary } = matrix;
  console.log(
    `\ntimbre summary: ${summary.presetPairsBelow} preset, ${summary.sameGroupPairsBelow} same-group, ${summary.targetPairsBelow} listed pair(s) and ${summary.spectralBelow} measurement(s) below threshold`,
  );
}

export function runTimbre(run: TimbreRun): number {
  const matrix = buildMatrix(run.wasm, run.only);
  const templates: TemplateIdentity | null = run.only === null ? measureTemplates(run.repo, run.wasm) : null;
  mkdirSync(dirname(run.out), { recursive: true });
  writeFileSync(run.out, `${JSON.stringify({ ...matrix, templates }, null, 2)}\n`);
  printMatrix(matrix);
  if (templates !== null) printIdentity(templates);
  console.log(`  → ${run.out}`);
  const templateFailures = templates === null ? [] : identityFailures(templates);
  for (const failure of templateFailures) console.log(`  template: ${failure}`);
  const failures = matrix.belowThreshold.length + matrix.spectralFailures.length + templateFailures.length;
  if (run.failClosed && failures > 0) {
    console.error(`sim --timbre FAIL: ${matrix.belowThreshold.length} pair(s), ${matrix.spectralFailures.length} measurement(s) and ${templateFailures.length} template rule(s) below threshold`);
    return 1;
  }
  console.log(run.failClosed ? "sim --timbre PASS" : "sim --timbre: report only (pass --fail-closed to gate CI)");
  return 0;
}
