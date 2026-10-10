// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { stepCellState } from "./step-grid";
describe("stepCellState", () => {
  it("shows a note or a chord and presses the step", () => {
    expect(stepCellState({ kind: "note", label: "eb4" })).toEqual({ text: "eb4", isOn: true });
    expect(stepCellState({ kind: "chord", label: "Fm7" })).toEqual({ text: "Fm7", isOn: true });
  });
  it("presses a hit or a hold without a label, and leaves a rest up", () => {
    expect(stepCellState({ kind: "hit", label: null })).toEqual({ text: "", isOn: true });
    expect(stepCellState({ kind: "hold", label: null })).toEqual({ text: "", isOn: true });
    expect(stepCellState({ kind: "rest", label: null })).toEqual({ text: "", isOn: false });
  });
});
