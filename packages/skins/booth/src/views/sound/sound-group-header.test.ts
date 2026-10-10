// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { track } from "../../testing/view-fixture";
import { changeSoundLabel } from "./sound-group-header";
describe("changeSoundLabel", () => {
  it("names the track and the sound it plays now", () => {
    expect(changeSoundLabel({ ...track("ride", "drum"), instrument: "hat", preset: "closed" })).toBe("Change sound of ride, now hat closed");
  });
  it("names the instrument alone on its default sound", () => {
    expect(changeSoundLabel({ ...track("ride", "drum"), instrument: "hat", preset: "" })).toBe("Change sound of ride, now hat");
  });
});
