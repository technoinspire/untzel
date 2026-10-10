// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { nextKeyIndex, rovingIndex } from "./roving-keys";
describe("rovingIndex", () => {
  it("moves along a row with Left and Right, along a column with Up and Down", () => {
    expect(rovingIndex(1, 4, "ArrowRight", false)).toBe(2);
    expect(rovingIndex(1, 4, "ArrowLeft", false)).toBe(0);
    expect(rovingIndex(1, 4, "ArrowDown", true)).toBe(2);
    expect(rovingIndex(1, 4, "ArrowUp", true)).toBe(0);
  });
  it("ignores the arrows of the other axis and every other key", () => {
    expect(rovingIndex(1, 4, "ArrowDown", false)).toBeNull();
    expect(rovingIndex(1, 4, "ArrowRight", true)).toBeNull();
    expect(rovingIndex(1, 4, "Enter", false)).toBeNull();
  });
  it("goes to the ends with Home and End and stops there", () => {
    expect(rovingIndex(2, 4, "Home", true)).toBe(0);
    expect(rovingIndex(2, 4, "End", false)).toBe(3);
    expect(rovingIndex(3, 4, "ArrowRight", false)).toBe(3);
    expect(rovingIndex(0, 4, "ArrowUp", true)).toBe(0);
  });
  it("does nothing outside the items", () => {
    expect(rovingIndex(-1, 4, "ArrowRight", false)).toBeNull();
  });
});
describe("nextKeyIndex", () => {
  it("moves one key right or left", () => {
    expect(nextKeyIndex(3, "ArrowRight", 24)).toBe(4);
    expect(nextKeyIndex(3, "ArrowLeft", 24)).toBe(2);
  });
  it("stops at both ends of the keyboard", () => {
    expect(nextKeyIndex(0, "ArrowLeft", 24)).toBe(0);
    expect(nextKeyIndex(23, "ArrowRight", 24)).toBe(23);
  });
  it("leaves other keys and a target outside the keys alone", () => {
    expect(nextKeyIndex(3, "ArrowUp", 24)).toBeNull();
    expect(nextKeyIndex(3, "Enter", 24)).toBeNull();
    expect(nextKeyIndex(-1, "ArrowRight", 24)).toBeNull();
  });
});
