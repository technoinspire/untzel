// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { StepView } from "@untzel/presentation/view-model";
import { track } from "../../testing/view-fixture";
import { STEP_COUNTS, stepCountShown } from "./track-steps-group";
describe("stepCountShown", () => {
  const rest: StepView = { kind: "rest", label: null };
  it("counts the steps of the bar in edit", () => {
    const kick = { ...track("kick", "drum", 2), patternBars: [Array.from({ length: 16 }, () => rest), Array.from({ length: 32 }, () => rest)] };
    expect(stepCountShown(kick, 0)).toBe(16);
    expect(stepCountShown(kick, 1)).toBe(32);
  });
  it("falls back to the pattern's steps past the last bar", () => {
    expect(stepCountShown(track("kick", "drum"), 5)).toBe(8);
  });
  it("offers 8, 16 and 32 steps per bar", () => {
    expect(STEP_COUNTS).toEqual([8, 16, 32]);
  });
});
