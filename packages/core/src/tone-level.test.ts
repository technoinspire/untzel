// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Tone changes the colour, not the volume.
import { describe, expect, it } from "vitest";
import { parseManifest, type InstrumentManifest } from "./manifest/manifest";
import { toneLevelFactor, type WrittenParameters } from "./mix/parameters";

const NOISE = {
  name: "noise",
  group: "fx",
  kind: "drum",
  engine: "percussion",
  description: "Noise for sweeps and rises",
  tags: [],
  voices: 2,
  allocation: "poly",
  steal: "oldest",
  costPerVoice: 1,
  patterns: [{ name: "Hit", text: "x..." }],
  preview: "x...",
  defaultDuck: 0,
  parameters: [{ name: "cutoff", min: 20, max: 20000, default: 2000, unit: "Hz", curve: "exponential" }],
  tone: [{ parameter: "cutoff", from: 200, to: 20000 }],
  toneLevelDb: 12,
  presets: [{ name: "white", description: "White noise", values: {} }],
  defaultPreset: "white",
};

function manifest(json: unknown): InstrumentManifest {
  const result = parseManifest(json);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.manifest;
}

const written = (tone: number | null): WrittenParameters =>
  ({ tone: tone === null ? null : { kind: "constant", value: tone }, preset: {} }) as unknown as WrittenParameters;

describe("tone level", () => {
  const noise = manifest(NOISE);

  it("reads toneLevelDb, 0 when absent, and refuses a wild value", () => {
    expect(noise.toneLevelDb).toBe(12);
    expect(manifest({ ...NOISE, toneLevelDb: undefined }).toneLevelDb).toBe(0);
    expect(parseManifest({ ...NOISE, toneLevelDb: 90 }).ok).toBe(false);
  });

  it("is 1 without tone and at the tone where the sound rests", () => {
    expect(toneLevelFactor(written(null), noise)).toBe(1);
    // cutoff 2000 sits half way between 200 and 20000 on the exponential curve.
    expect(toneLevelFactor(written(0.5), noise)).toBeCloseTo(1, 6);
  });

  it("moves the gain against the measured level: −6 dB at tone 1, +6 dB at tone 0", () => {
    expect(20 * Math.log10(toneLevelFactor(written(1), noise))).toBeCloseTo(-6, 6);
    expect(20 * Math.log10(toneLevelFactor(written(0), noise))).toBeCloseTo(6, 6);
  });
});
