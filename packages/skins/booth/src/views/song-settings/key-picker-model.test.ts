// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { formatKey } from "../../behavior/text/format";
import { keyPickerModel } from "./key-picker-model";

describe("keyPickerModel", () => {
  it("offers 12 tonics and 5 scales, the current ones chosen", () => {
    const model = keyPickerModel("c", "minor");
    expect(model.tonics.map((tonic) => tonic.label)).toEqual(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]);
    expect(model.tonics.filter((tonic) => tonic.isChosen).map((tonic) => tonic.text)).toEqual(["c"]);
    expect(model.scales.map((scale) => scale.scale)).toEqual(["minor", "major", "dorian", "phrygian", "chromatic"]);
    expect(model.scales.find((scale) => scale.isChosen)?.scale).toBe("minor");
    expect(model.note).toBe("Notes outside the scale move to the nearest note in it.");
  });

  it("lights Eb for a tonic written as d#", () => {
    expect(keyPickerModel("d#", "dorian").tonics.find((tonic) => tonic.isChosen)?.label).toBe("Eb");
  });

  it("says chromatic turns the scale lock off", () => {
    expect(keyPickerModel("a", "chromatic").note).toBe("every note · scale lock off");
  });

  it("writes the key in lower case, like the text", () => {
    expect(formatKey("a", "minor")).toBe("a minor");
    expect(formatKey("f#", "phrygian")).toBe("f# phrygian");
  });
});
