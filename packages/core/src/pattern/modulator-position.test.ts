// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAcceptedModulator, modulatorValueAt, type ModulatorInput } from "./modulator-position";

/** The vectors the Rust engine reproduces in modulation::tests::light_vectors. */
const VECTORS = readFileSync(new URL("../../../dsp/vectors/modulators.txt", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.trim().split(/\s+/));

function vector(fields: readonly string[]): { readonly modulator: ModulatorInput; readonly frame: number; readonly noteFrame: number; readonly value: number } {
  const n = (index: number): number => Number(fields[index]);
  if (fields[0] === "lfo") {
    return { modulator: { kind: "lfo", shape: n(1), curve: n(2), periodFrames: n(3), originFrame: n(4), low: n(5), high: n(6) }, frame: n(7), noteFrame: n(8), value: n(9) };
  }
  return { modulator: { kind: "envelope", curve: n(1), seconds: n(2), low: n(3), high: n(4) }, frame: n(5), noteFrame: n(6), value: n(7) };
}

describe("modulatorValueAt, a port of dsp modulation.rs", () => {
  it("has the engine's vectors to check", () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(50);
  });

  it.each(VECTORS.map((fields) => [fields.join(" "), fields] as const))("%s", (_, fields) => {
    const { modulator, frame, noteFrame, value } = vector(fields);
    const got = modulatorValueAt(modulator, frame, noteFrame, 48_000);
    expect(Math.abs(got - value)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(value)));
  });

  it("refuses what the DSP refuses", () => {
    expect(isAcceptedModulator({ kind: "lfo", shape: 0, curve: 0, periodFrames: 0, originFrame: 0, low: 0, high: 1 })).toBe(false);
    expect(isAcceptedModulator({ kind: "envelope", curve: 1, seconds: 0.2, low: 0, high: 1 })).toBe(false);
    expect(isAcceptedModulator({ kind: "envelope", curve: 0, seconds: 0.2, low: 0, high: Number.NaN })).toBe(false);
    expect(isAcceptedModulator({ kind: "lfo", shape: 2, curve: 1, periodFrames: 100, originFrame: 0, low: 300, high: 1400 })).toBe(true);
  });
});
