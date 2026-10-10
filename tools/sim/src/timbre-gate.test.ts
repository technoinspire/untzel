// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { longTermSpectrum, THIRD_OCTAVE_CENTERS } from "./measure/ltas";
import { mainSection } from "./templates/template-identity";
import { partialLevelsDb, rmsSwingDb } from "./timbre/timbre-probes";
import { groupPairs, presetPairs, spectralViolation, targetPairs, withExceptions, type MeasuredSound } from "./timbre/timbre-rules";
import type { TimbreFeatures } from "./timbre/timbre";
import type { SpectralTarget } from "./timbre/timbre-targets";

const RATE = 48_000;

function tones(seconds: number, parts: readonly [number, number][]): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parts.reduce((sum, [hz, amplitude]) => sum + amplitude * Math.sin((2 * Math.PI * hz * i) / RATE), 0);
  }
  return out;
}

function features(mfcc: readonly number[], attackSeconds = 0.01, decaySeconds = 1): TimbreFeatures {
  return { mfcc, attackSeconds, decaySeconds, centroidHz: 0, rolloffHz: 0, flatness: 0, harmonicToNoiseDb: 0 };
}

function sound(id: string, group: MeasuredSound["group"], mfcc: readonly number[], isDefault = true, decay = 1): MeasuredSound {
  const [instrument = "", preset = ""] = id.split(" ");
  return { id, instrument, group, preset, isDefault, features: features(mfcc, 0.01, decay) };
}

describe("timbre probes", () => {
  it("reads a partial's level against the fundamental", () => {
    const signal = tones(1.2, [[130.8, 1], [261.6, 0.1]]);
    const [second] = partialLevelsDb(signal, RATE, 130.8, [2]);
    expect(second).toBeCloseTo(-20, 0);
  });

  it("reads no swing in a steady tone and the swing of a beating pair", () => {
    expect(rmsSwingDb(tones(2, [[440, 0.5]]), RATE, 0.5, 1.5)).toBeLessThan(0.5);
    expect(rmsSwingDb(tones(2, [[440, 0.5], [441, 0.5]]), RATE, 0.5, 1.5)).toBeGreaterThan(10);
  });
});

describe("long-term spectrum", () => {
  it("has one level per third octave and puts a tone in its band", () => {
    const bands = longTermSpectrum(tones(1, [[1000, 0.5]]), RATE);
    expect(bands).toHaveLength(THIRD_OCTAVE_CENTERS.length);
    expect(bands.indexOf(Math.max(...bands))).toBe(THIRD_OCTAVE_CENTERS.indexOf(1000));
  });

  it("measures shape only: a level change leaves the bands where they are", () => {
    const quiet = longTermSpectrum(tones(1, [[200, 0.1], [3000, 0.05]]), RATE);
    const loud = longTermSpectrum(tones(1, [[200, 0.4], [3000, 0.2]]), RATE);
    quiet.forEach((band, i) => expect(Math.abs(band - loud[i]!)).toBeLessThan(0.01));
  });
});

describe("template main section", () => {
  it("is the section with the most tracks, the later of equals", () => {
    const source = "section intro a b\nsection drop a b c\nsection drop2 a b c | loop\nsong intro 4, drop 8";
    expect(mainSection(source)).toBe("drop2");
    expect(mainSection("tempo 120\nk: kick x...")).toBeNull();
  });
});

describe("timbre rules", () => {
  it("passes distinct presets and fails close ones without an envelope excuse", () => {
    const results = presetPairs([sound("pad warm", "pads", [0, 0]), sound("pad dark", "pads", [20, 0], false), sound("pad sea", "pads", [21, 0], false)]);
    expect(results.filter((result) => result.violation !== null).map((result) => `${result.a}~${result.b}`)).toEqual(["pad dark~pad sea"]);
  });

  it("lets only one envelope-only pair through per instrument", () => {
    const results = presetPairs([
      // ride: a synthesised drum (hat plays recordings).
      sound("ride closed", "drums", [0], true, 0.05),
      sound("ride open", "drums", [1], false, 0.5),
      sound("ride long", "drums", [2], false, 2),
    ]);
    expect(results.filter((result) => result.violation === null)).toHaveLength(1);
  });

  it("tells two kicks apart by MFCC or by decay", () => {
    const pair = (mfcc: number, decay: number) => presetPairs([sound("kick punch", "drums", [0], true, 0.2), sound("kick boom", "drums", [mfcc], false, decay)])[0]?.violation;
    expect(pair(5, 0.2)).toBeNull();
    expect(pair(3, 0.4)).toBeNull();
    expect(pair(3, 0.25)).toContain("decay ratio");
  });

  it("compares default sounds of one group only", () => {
    const results = groupPairs([sound("pad warm", "pads", [0]), sound("strings ensemble", "pads", [10]), sound("lead classic", "leads", [1])]);
    expect(results).toHaveLength(1);
    expect(results[0]?.violation).toContain("same group");
  });

  it("fails a listed pair whose sound does not exist, and skips one outside --only", () => {
    const lookup = (id: string) => (id === "a x" ? features([0]) : id === "b y" ? null : undefined);
    expect(targetPairs([{ a: "a x", b: "b y", min: 15, render: "note", source: "t" }], lookup)).toEqual([]);
    expect(targetPairs([{ a: "a x", b: "c z", min: 15, render: "note", source: "t" }], lookup)[0]?.violation).toContain("no such sound");
  });

  it("checks a measurement against its bound and explains it only while it fails", () => {
    const target: SpectralTarget = { kind: "swing", subject: "supersaw anthem", maxDb: 4, source: "b.1-3" };
    expect(spectralViolation(target, [3])).toBeNull();
    expect(spectralViolation(target, [8])).toContain("swing");
    const exception = [{ kind: "swing" as const, subject: "supersaw anthem", measured: 8, reason: "the unison beats" }];
    expect(withExceptions(target, spectralViolation(target, [8]), exception)).toBeNull();
    expect(withExceptions(target, spectralViolation(target, [3]), exception)).toContain("remove its exception");
  });
});
