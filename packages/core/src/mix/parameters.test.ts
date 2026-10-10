// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { EFFECT_PARAMETERS } from "../manifest/effects";
import type { InstrumentManifest } from "../manifest/manifest";
import { resolveTrackParameters, type WrittenParameters } from "./parameters";
import { rational } from "../time/rational";

const BASS: InstrumentManifest = {
  name: "bass",
  group: "bass",
  kind: "pitched",
  range: { lowest: 24, highest: 60 },
  toneLevelDb: 0,
  engine: "legacy",
  description: "Saw bass with a plucked filter",
  model: null,
  tags: [],
  voices: 2,
  allocation: "poly",
  steal: "oldest",
  costPerVoice: 1.4,
  defaultPattern: "c2 . . c2 . . c2 .",
  patterns: [{ name: "Dotted", text: "c2 . . c2 . . c2 ." }],
  preview: "c2 . . c2",
  defaultDuck: 0.6,
  parameters: [
    { name: "cutoff", min: 40, max: 8000, default: 600, unit: "Hz", curve: "exponential", choices: null },
    { name: "decay", min: 0.05, max: 2, default: 0.3, unit: "s", curve: "exponential", choices: null },
    { name: "drive", min: 0, max: 1, default: 0.1, unit: "", curve: "linear", choices: null },
  ],
  tone: [{ parameter: "cutoff", from: 120, to: 3000 }],
  presets: [{ name: "round", description: "Round", values: {} }],
  defaultPreset: "round",
  scene: null,
};

const NOTHING: WrittenParameters = {
  gain: null,
  pan: null,
  duck: null,
  tone: null,
  reverb: null,
  delay: null,
  glide: null,
  legato: false,
  effects: [],
  instrument: [],
  preset: {},
};

const sine4 = { shape: "sine", periodBars: rational(4n, 1n) } as const;

function valueOf(written: WrittenParameters, name: string): unknown {
  return resolveTrackParameters(written, BASS).find((parameter) => parameter.name === name)?.value;
}

describe("resolveTrackParameters", () => {
  it("gives one parameter per index with defaults", () => {
    const resolved = resolveTrackParameters(NOTHING, BASS);
    expect(resolved.map((parameter) => [parameter.index, parameter.name])).toEqual([
      [0, "gain"],
      [1, "pan"],
      [2, "reverbSend"],
      [3, "reverbSpace"],
      [4, "delaySend"],
      [5, "delayDivision"],
      [6, "duck"],
      [7, "glide"],
      [8, "legato"],
      [9, "audible"],
      ...EFFECT_PARAMETERS.map((effect, position) => [16 + position, effect.name]),
      [32, "cutoff"],
      [33, "decay"],
      [34, "drive"],
    ]);
    expect(resolved.map((parameter) => parameter.value)).toEqual(
      [1, 0, 0, 1, 0, 0, 0.6, 0, 0, 1, ...EFFECT_PARAMETERS.map((effect) => effect.default), 600, 0.3, 0.1].map(
        (value) => ({ kind: "constant", value }),
      ),
    );
    expect(resolved.every((parameter) => !parameter.explicit)).toBe(true);
  });

  it("maps reverb and delay to buses", () => {
    expect(valueOf({ ...NOTHING, reverb: { kind: "space", space: "sea", send: null } }, "reverbSend")).toEqual({ kind: "constant", value: 0.3 });
    expect(valueOf({ ...NOTHING, reverb: { kind: "space", space: "sea", send: null } }, "reverbSpace")).toEqual({ kind: "constant", value: 2 });
    const send = { ...NOTHING, reverb: { kind: "send", value: { kind: "constant", value: 0.5 } } } as const;
    expect(valueOf(send, "reverbSend")).toEqual({ kind: "constant", value: 0.5 });
    expect(valueOf(send, "reverbSpace")).toEqual({ kind: "constant", value: 1 });
    expect(valueOf({ ...NOTHING, delay: "3/16" }, "delaySend")).toEqual({ kind: "constant", value: 0.35 });
    expect(valueOf({ ...NOTHING, delay: "3/16" }, "delayDivision")).toEqual({ kind: "constant", value: 1 });
  });

  it("expands a constant tone along the parameter curve", () => {
    const value = valueOf({ ...NOTHING, tone: { kind: "constant", value: 0.5 } }, "cutoff") as { value: number };
    expect(value.value).toBeCloseTo(120 * Math.sqrt(25), 9);
  });

  it("turns a tone signal into a signal over the tone range", () => {
    const written = { ...NOTHING, tone: { kind: "signal", signal: sine4, from: 0.2, to: 0.8 } } as const;
    expect(valueOf(written, "cutoff")).toEqual({
      kind: "signal",
      signal: sine4,
      low: 0.2,
      high: 0.8,
      from: 120,
      to: 3000,
      curve: "exponential",
    });
  });

  it("lets an explicit parameter win over tone", () => {
    const written: WrittenParameters = {
      ...NOTHING,
      tone: { kind: "constant", value: 1 },
      instrument: [{ name: "cutoff", value: { kind: "signal", signal: sine4, from: 300, to: 1400 } }],
    };
    const cutoff = resolveTrackParameters(written, BASS).find((parameter) => parameter.name === "cutoff");
    expect(cutoff).toEqual({
      index: 32,
      name: "cutoff",
      explicit: true,
      value: { kind: "signal", signal: sine4, low: 0, high: 1, from: 300, to: 1400, curve: "exponential" },
    });
  });

  it("marks written general parameters as explicit", () => {
    const resolved = resolveTrackParameters({ ...NOTHING, gain: { kind: "constant", value: 0.4 } }, BASS);
    expect(resolved[0]).toEqual({ index: 0, name: "gain", value: { kind: "constant", value: 0.4 }, explicit: true });
  });
});
