// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { curl, curlAdvect, flowNoise } from "./flow-noise";
// Flow noise and curl (THIRD_PARTY.md): fixed vectors, so a change to the lattice
// or the hash, which would change every link's animation, fails here first.

const VECTORS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0.3, 0.7, 0, 1, -0.494372070845, 1.22923622039, 2.62085108533],
  [1.25, -2.5, 0.5, 7, -0.271944407662, 2.46718860391, -1.51320862708],
  [10.1, 3.3, 2, 0x5ce7, 0.578724905081, 1.92481215834, 0.406094894385],
];

describe("flow noise", () => {
  it.each(VECTORS)("gives the pinned value at (%f, %f), time %f, seed %i", (x, y, time, seed, value, curlX, curlY) => {
    expect(flowNoise(x, y, time, seed)).toBeCloseTo(value, 10);
    const [cx, cy] = curl(x, y, time, seed);
    expect(cx).toBeCloseTo(curlX, 9);
    expect(cy).toBeCloseTo(curlY, 9);
  });

  it("stays within ±1 and moves with time and seed", () => {
    let largest = 0;
    for (let i = 0; i < 2000; i += 1) largest = Math.max(largest, Math.abs(flowNoise(i * 0.137, i * 0.071, i * 0.01, 3)));
    expect(largest).toBeLessThanOrEqual(1);
    expect(flowNoise(0.3, 0.7, 0.4, 1)).not.toBe(flowNoise(0.3, 0.7, 0, 1));
    expect(flowNoise(0.3, 0.7, 0, 2)).not.toBe(flowNoise(0.3, 0.7, 0, 1));
  });

  it("has a curl free of divergence, so the dust neither gathers nor thins", () => {
    const h = 1e-4;
    for (const [x, y] of [[0.3, 0.7], [2.1, -1.4], [5.5, 4.2]] as const) {
      const divergence = ((curl(x + h, y, 0.2, 9)[0] - curl(x - h, y, 0.2, 9)[0]) + (curl(x, y + h, 0.2, 9)[1] - curl(x, y - h, 0.2, 9)[1])) / (2 * h);
      expect(Math.abs(divergence)).toBeLessThan(1e-3);
    }
  });

  it("advects a grain as a pure function of birth and age", () => {
    expect(curlAdvect(0.1, 0.2, 0.3, 1, 0.02, 5, 3)).toEqual(curlAdvect(0.1, 0.2, 0.3, 1, 0.02, 5, 3));
    expect(curlAdvect(0.1, 0.2, 0, 1, 0.02, 5, 3)).toEqual([0.1, 0.2]);
  });
});
