// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The flow noise on the GPU against the CPU: the GLSL the
// renderer compiles, evaluated in a 1 × 3 float target at the vectors pinned by
// packages/light/src/composer/flow-noise.test.ts, matches the CPU to 1e-5. The lattice hash is
// integer-only on both sides, so only floating-point precision may differ.
import { expect, test } from "@playwright/test";
import { startEngine } from "../../support/share-support";
import { collectErrors } from "../../../../support/support";
const VECTORS = [
  { x: 0.3, y: 0.7, time: 0, seed: 1, value: -0.494372070845 },
  { x: 1.25, y: -2.5, time: 0.5, seed: 7, value: -0.271944407662 },
  { x: 10.1, y: 3.3, time: 2, seed: 0x5ce7, value: 0.578724905081 },
];
interface GpuLab {
  flowNoise(x: number, y: number, time: number, seed: number): number;
  flowNoiseOnGpu(points: readonly { x: number; y: number; time: number; seed: number }[]): readonly number[] | null;
}
test("the GLSL flow noise gives the CPU's pinned vectors in a 1 × 3 target", async ({ page }) => {
  const errors = collectErrors(page);
  await startEngine(page);
  const { gpu, cpu } = await page.evaluate(async (points) => {
    const lab = await (globalThis as unknown as { untzelTest: { gpuLab(): Promise<GpuLab> } }).untzelTest.gpuLab();
    return { gpu: lab.flowNoiseOnGpu(points), cpu: points.map((point) => lab.flowNoise(point.x, point.y, point.time, point.seed)) };
  }, VECTORS);
  expect(gpu, "WebGL2 with float targets").not.toBeNull();
  VECTORS.forEach((vector, index) => {
    expect(cpu[index]).toBeCloseTo(vector.value, 10);
    expect(Math.abs((gpu?.[index] ?? Number.NaN) - vector.value), `vector ${index}`).toBeLessThanOrEqual(1e-5);
  });
  expect(errors).toEqual([]);
});
