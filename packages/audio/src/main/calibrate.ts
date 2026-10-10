// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { WorkletStats } from "../protocol";
import { benchmarkDsp } from "./benchmark";
import { calibrationFromRuns, type Calibration } from "./load-meter";
import type { OfflineScore } from "./offline";

/**
 * Calibrated against the scale test: both runs at 48 kHz, 4 s each after a 0.5 s warm-up
 * that is not timed, rendered by the worklet's DspHost on the main thread in short
 * slices that alternate between the two runs (benchmark.ts). Runs in an OfflineAudioContext read the meter from
 * −57% to +75% of CDP renderCapacity between page loads.
 */
export const CALIBRATION_SAMPLE_RATE = 48_000;
/** The empty run lasts as long as the loaded one: they alternate slice by slice. */
export const EMPTY_RUN_SECONDS = 4;
export const LOADED_RUN_SECONDS = 4;
export const WARMUP_SECONDS = 0.5;

/**
 * What the realtime audio thread spends per quantum outside the DSP (the AudioWorklet
 * call, the output copy, the graph and the destination), as a fraction of a quantum.
 * The page cannot time it. Measured by the scale test on the reference Mac, Chrome 154:
 * renderCapacity minus the DSP benchmark was 0.0061–0.0077 at every track count, 1 to 64.
 * The scale test re-measures it; change it with the table.
 */
export const REALTIME_GRAPH_OVERHEAD = 0.007;

export interface CalibrationInput {
  readonly module: WebAssembly.Module;
  readonly instrumentHashes: readonly number[];
  /** Scheduled over WARMUP_SECONDS + LOADED_RUN_SECONDS at CALIBRATION_SAMPLE_RATE. */
  readonly loadedScore: OfflineScore;
  /** Units the timed part of the loaded render really had (LoadMeter.unitsOf). */
  readonly unitsOf: (from: WorkletStats | null, to: WorkletStats) => number;
  readonly now?: () => number;
  readonly pause?: () => Promise<void>;
}

export async function calibrate(input: CalibrationInput): Promise<Calibration> {
  const common = {
    module: input.module,
    instrumentHashes: input.instrumentHashes,
    sampleRate: CALIBRATION_SAMPLE_RATE,
    warmupSeconds: WARMUP_SECONDS,
    now: input.now ?? (() => performance.now()),
    pause: input.pause ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0))),
  };
  // Interleaved slice by slice (benchmark.ts): both runs see the same WASM tier and CPU clock.
  const [empty, loaded] = await benchmarkDsp({ ...common, seconds: LOADED_RUN_SECONDS, scores: [[], input.loadedScore] });
  if (empty === undefined || loaded === undefined) throw new Error("calibration: missing benchmark run");
  const dsp = calibrationFromRuns(empty, { ...loaded, units: input.unitsOf(loaded.statsBefore, loaded.stats) });
  return { ...dsp, fixedFraction: dsp.fixedFraction + REALTIME_GRAPH_OVERHEAD };
}
