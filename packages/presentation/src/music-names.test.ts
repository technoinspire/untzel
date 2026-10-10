// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { keyLabel, midiName } from "./music-names";
describe("midiName", () => {
  it("names a note with c4 = 60", () => {
    expect(midiName(24)).toBe("c1");
    expect(midiName(39)).toBe("eb2");
    expect(midiName(60)).toBe("c4");
  });
  it("names only the pitch class below c0", () => {
    expect(midiName(5)).toBe("f");
  });
});
describe("keyLabel", () => {
  it("spells the tonic and the scale, and c minor without a key", () => {
    expect(keyLabel({ tonic: 2, scale: "dorian" })).toBe("d dorian");
    expect(keyLabel(null)).toBe("c minor");
  });
});
