// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { tappedBar } from "./range-ruler-pointer";
describe("tappedBar", () => {
  it("is the bar under the tap, counted from 1", () => {
    expect(tappedBar(0.2, 8)).toBe(1);
    expect(tappedBar(3.9, 8)).toBe(4);
  });
  it("never passes the last bar, even at the right edge", () => {
    expect(tappedBar(8, 8)).toBe(8);
    expect(tappedBar(0, 0)).toBe(1);
  });
});
