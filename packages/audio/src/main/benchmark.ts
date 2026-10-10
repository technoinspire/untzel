// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The DSP's cost per unit, measured on the main thread with the worklet's own DspHost.
// An OfflineAudioContext renders on an ordinary thread, which macOS may put on an
// efficiency core: its timings read 0.8x to 4x the realtime cost from run to run
// (measured). The main thread, like the audio thread, runs at
// interactive priority.
//
// Every score gets its own DspHost, and the timed slices take turns (empty, loaded,
// empty, ...), so a change of speed during the run (V8 tiering the WASM up, the CPU
// clock) touches every score alike. Measured: timing the empty score first, alone, read
// its cost 1x or 7x from page load to page load, depending on when V8's optimized code
// arrived.

import { PROTOCOL_VERSION, type WorkletStats } from "../protocol";
import { DspHost, QUANTUM } from "../worklet/dsp-host";
import type { OfflineScore } from "./offline";

/**
 * Quanta rendered between two yields to the page: about 4 ms of work at 24 instances,
 * and long enough that the browser's coarse clock (100 µs without cross-origin
 * isolation) still resolves the empty score.
 */
const SLICE_QUANTA = 64;
/** The slowest slices (an OS interruption inside a slice) are left out of the mean. */
const TRIM_SLOWEST = 0.2;
/** The warm-up lasts at least this long in wall time, so the optimized WASM code is in. */
const MIN_WARMUP_MS = 250;

export interface BenchmarkInput {
  readonly module: WebAssembly.Module;
  readonly instrumentHashes: readonly number[];
  readonly sampleRate: number;
  /** Rendered first by every score and not timed (tier-up, caches). */
  readonly warmupSeconds: number;
  /** Timed audio per score. */
  readonly seconds: number;
  /** Each score scheduled over warmupSeconds + seconds, or longer. */
  readonly scores: readonly OfflineScore[];
  readonly now: () => number;
  /** Gives the page a turn between slices (setTimeout 0 in the browser). */
  readonly pause: () => Promise<void>;
}

export interface Benchmark {
  /** Trimmed mean slice cost times the number of slices: interruptions do not count. */
  readonly renderMs: number;
  readonly audioSeconds: number;
  readonly statsBefore: WorkletStats;
  readonly stats: WorkletStats;
}

interface Run {
  readonly host: DspHost;
  frame: number;
  readonly costs: number[];
  statsBefore: WorkletStats | null;
}

const SLICE_FRAMES = SLICE_QUANTA * QUANTUM;

function renderSlice(run: Run): void {
  for (let quantum = 0; quantum < SLICE_QUANTA; quantum += 1, run.frame += QUANTUM) run.host.render(run.frame);
}

/** Mean without the slowest TRIM_SLOWEST: the coarse clock is jittered, so a mean is unbiased where a median is not. */
export function trimmedMean(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const kept = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * (1 - TRIM_SLOWEST))));
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}

/** One Benchmark per score, in the order given. */
export async function benchmarkDsp(input: BenchmarkInput): Promise<Benchmark[]> {
  const runs: Run[] = input.scores.map((score) => {
    const host = new DspHost(
      { module: input.module, protocol: PROTOCOL_VERSION, instrumentHashes: input.instrumentHashes },
      input.sampleRate,
    );
    for (const message of score) host.receive(message, 0);
    return { host, frame: 0, costs: [], statsBefore: null };
  });
  const warmupSlices = Math.ceil((input.warmupSeconds * input.sampleRate) / SLICE_FRAMES);
  const timedSlices = Math.max(1, Math.ceil((input.seconds * input.sampleRate) / SLICE_FRAMES));
  const warmupStarted = input.now();
  for (let slice = 0; slice < warmupSlices; slice += 1) {
    for (const run of runs) renderSlice(run);
    await input.pause();
  }
  // Past the scheduled warm-up the scores would run out of events: wait instead.
  while (input.now() - warmupStarted < MIN_WARMUP_MS) await input.pause();
  for (const run of runs) run.statsBefore = run.host.readStats(run.frame);
  for (let slice = 0; slice < timedSlices; slice += 1) {
    for (const run of runs) {
      const started = input.now();
      renderSlice(run);
      run.costs.push(input.now() - started);
    }
    await input.pause();
  }
  return runs.map((run) => ({
    renderMs: trimmedMean(run.costs) * timedSlices,
    audioSeconds: (timedSlices * SLICE_FRAMES) / input.sampleRate,
    statsBefore: run.statsBefore ?? run.host.readStats(0),
    stats: run.host.readStats(run.frame),
  }));
}
