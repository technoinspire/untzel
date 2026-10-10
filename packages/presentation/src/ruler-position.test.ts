// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { rulerBarNow } from "./ruler-position";

const range = { startBar: 3, endBar: 6, cycle: true };

describe("rulerBarNow", () => {
  it("without a range, steps and wraps on the loop", () => {
    expect(rulerBarNow(2, 0, 8, null, true)).toBe(2);
    expect(rulerBarNow(7, 1, 8, null, true)).toBe(0);
    expect(rulerBarNow(0, -1, 8, null, true)).toBe(7);
  });

  it("before the report of the range's start, the bar playing is the range's end", () => {
    expect(rulerBarNow(2, -1, 8, range, true)).toBe(5);
    expect(rulerBarNow(5, 1, 8, range, true)).toBe(2);
    expect(rulerBarNow(3, 2, 8, range, true)).toBe(5);
  });

  it("a range that does not cycle steps like no range", () => {
    expect(rulerBarNow(2, -1, 56, range, false)).toBe(1);
    expect(rulerBarNow(5, 1, 56, range, false)).toBe(6);
  });
});
