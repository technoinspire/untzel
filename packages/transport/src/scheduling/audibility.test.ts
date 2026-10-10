// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { GeneralParameter } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { isAudibleActivation, type AudibilityInput } from "./audibility";
import type { ActivatedModulator } from "../types";

function table(gain: number, audible = 1): number[] {
  const parameters = new Array<number>(10).fill(0);
  parameters[GeneralParameter.gain] = gain;
  parameters[GeneralParameter.audible] = audible;
  return parameters;
}

function gainLfo(low: number, high: number): ActivatedModulator {
  return { kind: "lfo", index: GeneralParameter.gain, shape: 0, curve: 0, periodFrames: 12_000, originFrame: 0, low, high };
}

const base: AudibilityInput = { isMuted: false, parameters: table(1), isGainConstant: true, modulators: [] };

describe("isAudibleActivation", () => {
  it("a playing track sounds", () => {
    expect(isAudibleActivation(base)).toBe(true);
  });

  it("| mute never sounds, whatever the gain", () => {
    expect(isAudibleActivation({ ...base, isMuted: true, modulators: [gainLfo(0, 1)] })).toBe(false);
  });

  it("a solo of another track (audible 0) is silent, even with a gain LFO", () => {
    expect(isAudibleActivation({ ...base, parameters: table(1, 0), modulators: [gainLfo(0, 1)] })).toBe(false);
  });

  it("a constant gain of 0 is silent", () => {
    expect(isAudibleActivation({ ...base, parameters: table(0) })).toBe(false);
  });

  it("gain sine 1/8 0..1 sounds though its resolved gain is 0", () => {
    expect(isAudibleActivation({ ...base, parameters: table(0), modulators: [gainLfo(0, 1)] })).toBe(true);
  });

  it("an LFO from 0 to 0 (a section gain of 0 times the modulator) is silent", () => {
    expect(isAudibleActivation({ ...base, parameters: table(0), modulators: [gainLfo(0, 0)] })).toBe(false);
  });

  it("a slow gain signal passing through 0 still sounds", () => {
    expect(isAudibleActivation({ ...base, parameters: table(0), isGainConstant: false })).toBe(true);
  });
});
