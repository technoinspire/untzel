// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sound of a 10:00 take with 2 000
// edits (decode, materialize, replay and the DSP) costs at most 5% of real time, with and
// without the materialize memory. The take comes from the simulator's live rig (the
// worker's TransportHost, the real Transport, the page's TakeRecorder) and its sound from
// the export's own ExportAudio over the DSP, the code the export worker runs, here in
// Node's V8 through Vite's module runner as pnpm sim loads it
// (tools/sim/src/take/take-render-measure.ts). Runs with pnpm test:browser --measure.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { runnerImport } from "vite";
import { measurementSuite, writeMeasurement } from "../../support/measure-support";

measurementSuite();
const REPO = fileURLToPath(new URL("../../../../../../../", import.meta.url));
const TAKE_SECONDS = 600;
const EDITS = 2_000;
const RNF6_SHARE = 0.05;

type Measure = typeof import("../../../../../../../tools/sim/src/take/take-render-measure");

test("the sound of a 10:00 take with 2 000 edits renders within 5% of real time, with and without the materialize memory", async () => {
  test.setTimeout(600_000);
  const { module } = await runnerImport<Measure>(`${REPO}tools/sim/src/take/take-render-measure.ts`, { configFile: false, root: REPO, logLevel: "error" });
  const wasm = new WebAssembly.Module(readFileSync(`${REPO}packages/dsp/dist/untzel_dsp.wasm`));
  const results = module.measureTakeRender(wasm, TAKE_SECONDS, EDITS);
  writeMeasurement("take-render", results);
  expect(results.frames).toBe(results.musicFrames);
  expect(results.withMemory.share, "with the materialize memory").toBeLessThanOrEqual(RNF6_SHARE);
  expect(results.withoutMemory.share, "without it").toBeLessThanOrEqual(RNF6_SHARE);
  expect(results.counters).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
});
