// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, isWellFormedName } from "./names";

describe("isWellFormedName", () => {
  it("accepts up to 24 characters and refuses 25", () => {
    expect(isWellFormedName("a".repeat(NAME_MAX_LENGTH))).toBe(true);
    expect(isWellFormedName("a".repeat(NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it("starts with a lower-case letter", () => {
    expect(isWellFormedName("hat")).toBe(true);
    expect(isWellFormedName("2hat")).toBe(false);
    expect(isWellFormedName("-hat")).toBe(false);
    expect(isWellFormedName("Hat")).toBe(false);
    expect(isWellFormedName("")).toBe(false);
  });

  it("takes digits, - and _ after the first letter, and nothing else", () => {
    expect(isWellFormedName("open-hat_2")).toBe(true);
    expect(isWellFormedName("open hat")).toBe(false);
    expect(isWellFormedName("hat!")).toBe(false);
  });
});
