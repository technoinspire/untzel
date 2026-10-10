// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { chordChoice } from "./chord-chips";
describe("chordChoice", () => {
  it("acts on the step's chord, its quality pressed", () => {
    expect(chordChoice({ kind: "chord", root: "F", quality: "m7" })).toEqual({ root: "F", quality: "m7" });
  });
  it("offers the qualities on C, none pressed, when the step plays no chord", () => {
    expect(chordChoice({ kind: "rest" })).toEqual({ root: "C", quality: null });
    expect(chordChoice({ kind: "note", note: "eb4" })).toEqual({ root: "C", quality: null });
  });
});
