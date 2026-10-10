// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { wrapIndex } from "./focus-containment";

describe("wrapIndex", () => {
  it("enters at the first stop with Tab and the last with Shift+Tab from outside or the heading", () => {
    expect(wrapIndex(5, -1, false)).toBe(0);
    expect(wrapIndex(5, -1, true)).toBe(4);
  });
  it("wraps from the last stop to the first with Tab", () => {
    expect(wrapIndex(5, 4, false)).toBe(0);
  });
  it("wraps from the first stop to the last with Shift+Tab", () => {
    expect(wrapIndex(5, 0, true)).toBe(4);
  });
  it("leaves every other step to the browser", () => {
    for (const index of [0, 1, 2, 3]) expect(wrapIndex(5, index, false)).toBeNull();
    for (const index of [1, 2, 3, 4]) expect(wrapIndex(5, index, true)).toBeNull();
  });
  it("keeps a single stop focused both ways", () => {
    expect(wrapIndex(1, 0, false)).toBe(0);
    expect(wrapIndex(1, 0, true)).toBe(0);
  });
  it("does nothing without stops", () => {
    expect(wrapIndex(0, -1, false)).toBeNull();
    expect(wrapIndex(0, -1, true)).toBeNull();
  });
});
