// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { trackEmptyStateModel } from "./track-empty-state-model";

describe("trackEmptyStateModel", () => {
  it("offers Kick, Bass, Hats and Chords, each named for what it does", () => {
    const model = trackEmptyStateModel(["kick", "bass", "hat", "pad"]);
    expect(model.title).toBe("Start with a sound");
    expect(model.starters.map((starter) => starter.label)).toEqual(["Kick", "Bass", "Hats", "Chords"]);
    expect(model.starters.map((starter) => starter.name)).toEqual(["Add kick and play", "Add bass and play", "Add hat and play", "Add pad and play"]);
  });

  it("leaves out a starter the library does not have", () => {
    expect(trackEmptyStateModel(["kick", "pad"]).starters.map((starter) => starter.label)).toEqual(["Kick", "Chords"]);
  });
});
