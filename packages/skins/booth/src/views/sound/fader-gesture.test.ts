// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { faderPositionAt } from "./fader-gesture";
describe("faderPositionAt", () => {
  it("is the share of the track left of the pointer", () => {
    expect(faderPositionAt(150, 100, 200)).toBe(0.25);
  });
  it("stays between 0 and 1 past either end", () => {
    expect(faderPositionAt(50, 100, 200)).toBe(0);
    expect(faderPositionAt(400, 100, 200)).toBe(1);
  });
  it("is 0 on a track that is not laid out", () => {
    expect(faderPositionAt(150, 100, 0)).toBe(0);
  });
});
