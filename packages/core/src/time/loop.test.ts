// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { loopLengthOf } from "./loop";
import type { Track } from "../program/program";

function track(bars: number): Track {
  return {
    name: `t${bars}`,
    instrument: "kick",
    pattern: { bars: Array.from({ length: bars }, () => ({ elements: [], source: { from: 0, to: 0 } })) },
    muted: false,
    free: false,
    transpose: 0,
    swing: null,
    shift: 0,
    preset: null,
    velocity: 0.8,
    legato: false,
    voicing: null,
    inversion: 0,
    arp: null,
    effects: [],
    modulators: [],
    parameters: [],
    source: { from: 0, to: 0 },
  };
}

describe("loopLengthOf", () => {
  it("is what the text says when it declares loop", () => {
    expect(loopLengthOf({ loopBars: 16, tracks: [track(1)] })).toEqual({ bars: 16, declared: true });
    expect(loopLengthOf({ loopBars: 1, tracks: [track(8)] })).toEqual({ bars: 1, declared: true });
  });

  it("without loop: the longest pattern, at least the 4-bar phrase and at most 16", () => {
    expect(loopLengthOf({ loopBars: null, tracks: [] })).toEqual({ bars: 4, declared: false });
    expect(loopLengthOf({ loopBars: null, tracks: [track(1), track(2)] })).toEqual({ bars: 4, declared: false });
    expect(loopLengthOf({ loopBars: null, tracks: [track(1), track(8)] })).toEqual({ bars: 8, declared: false });
    expect(loopLengthOf({ loopBars: null, tracks: [track(64)] })).toEqual({ bars: 16, declared: false });
  });
});
