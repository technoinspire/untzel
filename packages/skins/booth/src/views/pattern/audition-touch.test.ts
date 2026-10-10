// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { soundOfPitch, soundOfStepTap } from "./audition-touch";

describe("which sound a touch plays", () => {
  it("a drum step that turns on plays its hit; one that turns off is silent", () => {
    expect(soundOfStepTap({ kind: "rest", label: null }, "drum")).toEqual({ kind: "hit" });
    expect(soundOfStepTap({ kind: "hit", label: null }, "drum")).toBeNull();
  });

  it("a melodic step plays its note or chord; a rest or hold nothing", () => {
    expect(soundOfStepTap({ kind: "note", label: "eb2" }, "pitched")).toEqual({ kind: "note", note: "eb2" });
    expect(soundOfStepTap({ kind: "chord", label: "Cm7" }, "chord")).toEqual({ kind: "chord", root: "C", quality: "m7" });
    expect(soundOfStepTap({ kind: "hold", label: null }, "pitched")).toBeNull();
    expect(soundOfPitch({ kind: "rest" })).toBeNull();
    expect(soundOfPitch(null)).toBeNull();
  });
});
