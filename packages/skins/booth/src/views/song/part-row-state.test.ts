// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { viewFixture } from "../../testing/view-fixture";
import { partMeta, partRowStates, tracksLabel } from "./part-row-state";

describe("partRowStates", () => {
  const rows = partRowStates(viewFixture().song, 0);

  it("writes 'N bars · K tracks' and marks the part playing", () => {
    expect(rows.map((row) => row.meta)).toEqual([
      "8 bars · 1 track",
      "16 bars · 2 tracks · playing",
      "32 bars · 2 tracks",
    ]);
    expect(rows.map((row) => row.play)).toEqual([null, "playing", null]);
    expect(rows[1]?.label).toBe("drop, 16 bars · 2 tracks · playing");
  });

  it("draws the length up to 16 bars and the progress of the playing part only", () => {
    expect(rows.map((row) => row.length)).toEqual([0.5, 1, 1]);
    // Bar 13 of the song is bar 5 of the 16-bar drop that starts at bar 9.
    expect(rows[1]?.progress).toBe(0.25);
    expect(rows[0]?.progress).toBe(0);
  });

  it("knows which part's editor is open", () => {
    expect(rows.map((row) => row.isOpen)).toEqual([true, false, false]);
  });
});

describe("labels", () => {
  it("says one track and one bar in the singular", () => {
    expect(tracksLabel(1)).toBe("1 track");
    expect(partMeta({ bars: 1 }, 3, null)).toBe("1 bar · 3 tracks");
  });
});
