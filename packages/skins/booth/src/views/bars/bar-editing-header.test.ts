// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { clampedBar } from "./bar-editing-header";
describe("clampedBar", () => {
  it("moves to the bar asked for inside the pattern", () => {
    expect(clampedBar(2, 4)).toBe(2);
  });
  it("stays on the first and the last bar at the ends", () => {
    expect(clampedBar(-1, 4)).toBe(0);
    expect(clampedBar(4, 4)).toBe(3);
  });
});
