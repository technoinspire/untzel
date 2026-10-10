// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fnv1a32 } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { benchmarkDsp, trimmedMean } from "./benchmark";

const wasmPath = fileURLToPath(new URL("../../../dsp/dist/untzel_dsp.wasm", import.meta.url));
const hasWasm = existsSync(wasmPath);
const SR = 48_000;
const SLICE_FRAMES = 64 * 128;
// Registry order (createRegistry sorts by name): every directory of instruments/.
const instrumentsDir = fileURLToPath(new URL("../../../../instruments/", import.meta.url));
const HASHES = readdirSync(instrumentsDir)
  .filter((name) => existsSync(`${instrumentsDir}${name}/manifest.json`))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  .map((name) => fnv1a32(name));

describe.skipIf(!hasWasm)("benchmarkDsp (needs pnpm build:wasm)", () => {
  it("times only the slices after the warm-up, one host per score", async () => {
    // A clock that moves 1 ms on every read: every timed slice costs exactly 1 ms.
    let time = 0;
    const runs = await benchmarkDsp({
      module: new WebAssembly.Module(readFileSync(wasmPath)),
      instrumentHashes: HASHES,
      sampleRate: SR,
      warmupSeconds: 0.5,
      seconds: 2,
      scores: [[], []],
      now: () => (time += 1),
      pause: () => Promise.resolve(),
    });
    const slices = Math.ceil((2 * SR) / SLICE_FRAMES);
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.renderMs).toBe(slices);
      expect(run.audioSeconds).toBeCloseTo((slices * SLICE_FRAMES) / SR, 9);
      expect(run.statsBefore.frame).toBe(Math.ceil((0.5 * SR) / SLICE_FRAMES) * SLICE_FRAMES);
      expect(run.stats.frame - run.statsBefore.frame).toBe(slices * SLICE_FRAMES);
    }
  });

});

describe("trimmedMean", () => {
  it("leaves the slowest fifth out, never everything", () => {
    expect(trimmedMean([1, 1, 1, 1, 100, 1])).toBe(1);
    expect(trimmedMean([2, 4])).toBe(3);
    expect(trimmedMean([7])).toBe(7);
  });
});
