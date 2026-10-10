// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { GENERAL_MODIFIER_RULES } from "./general-modifier-rules";
import { GENERAL_MODIFIERS } from "../read/modifier-values";

describe("GENERAL_MODIFIER_RULES", () => {
  it("describes every modifier the analysis accepts on any track, once", () => {
    const names = GENERAL_MODIFIER_RULES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...GENERAL_MODIFIERS].sort());
  });

  it("gives every valued modifier an example that starts with its name", () => {
    for (const entry of GENERAL_MODIFIER_RULES) {
      if (entry.kind !== "flag") expect(entry.example.startsWith(`${entry.name} `)).toBe(true);
    }
  });
});
