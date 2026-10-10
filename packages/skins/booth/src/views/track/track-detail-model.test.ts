// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { scalePitchClassesOf } from "./track-detail-model";
describe("scalePitchClassesOf", () => {
  it("turns the scale's notes into pitch classes, in order", () => {
    expect(scalePitchClassesOf(["c", "d", "eb", "f", "g", "ab", "bb"])).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(scalePitchClassesOf(["f#", "a"])).toEqual([6, 9]);
  });
  it("leaves out what is not a note, and is empty without a key", () => {
    expect(scalePitchClassesOf(["c", "h"])).toEqual([0]);
    expect(scalePitchClassesOf([])).toEqual([]);
  });
});
