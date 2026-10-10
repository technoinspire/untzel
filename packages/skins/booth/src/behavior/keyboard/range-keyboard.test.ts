// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { rangeKeyDelta } from "./range-keyboard";

describe("rangeKeyDelta", () => {
  it("moves 1% of 0..1000 by an arrow, up and right up, down and left down", () => {
    expect(rangeKeyDelta("ArrowRight", false)).toBe(10);
    expect(rangeKeyDelta("ArrowUp", false)).toBe(10);
    expect(rangeKeyDelta("ArrowLeft", false)).toBe(-10);
    expect(rangeKeyDelta("ArrowDown", false)).toBe(-10);
  });
  it("moves 0.1% with Shift", () => {
    expect(rangeKeyDelta("ArrowRight", true)).toBe(1);
    expect(rangeKeyDelta("ArrowDown", true)).toBe(-1);
  });
  it("moves 10% by a page", () => {
    expect(rangeKeyDelta("PageUp", false)).toBe(100);
    expect(rangeKeyDelta("PageDown", false)).toBe(-100);
  });
  it("goes to the ends with Home and End", () => {
    expect(rangeKeyDelta("Home", false)).toBe(-Infinity);
    expect(rangeKeyDelta("End", false)).toBe(Infinity);
  });
  it("leaves every other key alone", () => {
    for (const key of ["Tab", "Enter", " ", "a", "Escape"]) expect(rangeKeyDelta(key, false)).toBeNull();
  });
});
