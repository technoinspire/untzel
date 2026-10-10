// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { gainProblems, lineOf } from "./gain-checks";
import { simRegistry } from "../registry";

describe("gain checks", () => {
  it("accepts a 6 ± 0.5 dB drop and a tone spread of 6 dB or less", () => {
    expect(gainProblems(6.02, 0)).toEqual([]);
    expect(gainProblems(5.6, -5.9)).toEqual([]);
    expect(gainProblems(5.3, 0)[0]).toMatch(/gain 0.5/);
    expect(gainProblems(6, 6.5)[0]).toMatch(/tone/);
  });

  it("writes the instrument's preview with one modifier", () => {
    const kick = simRegistry().registry.get("kick");
    if (kick === undefined) throw new Error("no kick");
    expect(lineOf(kick, "gain 0.5")).toBe(`tempo 124\nkey c minor\np: kick ${kick.preview} | gain 0.5\n`);
    expect(lineOf(kick, "")).toBe(`tempo 124\nkey c minor\np: kick ${kick.preview}\n`);
  });
});
