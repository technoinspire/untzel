// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { SCENE_FAMILIES, fnv1a32 } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { SCENE_ZONES } from "./scene-catalog";
import { sectionHueShift } from "./section-shift";
import { stagePlan } from "./stage-plan";

describe("stagePlan", () => {
  it("is a pure function of the header's hash", () => {
    expect(stagePlan(123)).toEqual(stagePlan(123));
  });

  it("draws one scale per family and one start per zone, in range", () => {
    const plan = stagePlan(fnv1a32("tempo 124\nkey a minor"));
    for (const family of SCENE_FAMILIES) {
      expect(plan.familyScale[family]).toBeGreaterThanOrEqual(0.85);
      expect(plan.familyScale[family]).toBeLessThanOrEqual(1.15);
    }
    for (const zone of SCENE_ZONES) expect(plan.zoneStart[zone]).toBeLessThan(1);
    expect(plan.isMirrored).toBe((plan.arrangement & 1) === 1);
  });

  it("gives different headers different stages", () => {
    const headers = ["tempo 124", "tempo 128", "tempo 140\nkey e minor", "tempo 122\nswing 0.1"];
    const arrangements = new Set(headers.map((header) => stagePlan(fnv1a32(header)).arrangement));
    const phases = new Set(headers.map((header) => stagePlan(fnv1a32(header)).rotationPhase));
    expect(arrangements.size).toBeGreaterThanOrEqual(2);
    expect(phases.size).toBe(4);
  });
});

describe("sectionHueShift", () => {
  it("turns at most 12° either way, the same for a section, 0 without one", () => {
    expect(sectionHueShift(5, null)).toBe(0);
    for (const name of ["intro", "drop", "break", "outro", "build"]) {
      const shift = sectionHueShift(99, name);
      expect(Math.abs(shift)).toBeLessThanOrEqual(12);
      expect(Number.isInteger(shift)).toBe(true);
      expect(sectionHueShift(99, name)).toBe(shift);
    }
  });
});
