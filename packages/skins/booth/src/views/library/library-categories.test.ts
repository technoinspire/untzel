// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { categoryChip } from "./library-categories";
describe("categoryChip", () => {
  const available = new Set(["drums", "bass"] as const);
  it("presses the chosen category", () => {
    expect(categoryChip("bass", "bass", available)).toEqual({ isPressed: true, isHidden: false });
    expect(categoryChip("drums", "bass", available).isPressed).toBe(false);
  });
  it("hides a category with nothing listed, never All", () => {
    expect(categoryChip("pads", "all", available).isHidden).toBe(true);
    expect(categoryChip("all", "all", new Set()).isHidden).toBe(false);
  });
});
