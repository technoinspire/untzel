// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { rulerBlocks } from "./range-ruler-layers";
describe("rulerBlocks", () => {
  it("draws one unnamed cell per bar of the loop", () => {
    expect(rulerBlocks({ mode: "loop", parts: [] }, 3)).toEqual([
      { startBar: 1, endBar: 1, name: "" },
      { startBar: 2, endBar: 2, name: "" },
      { startBar: 3, endBar: 3, name: "" },
    ]);
  });
  it("draws the song's parts with their names", () => {
    const parts = [{ startBar: 1, endBar: 8, name: "intro" }, { startBar: 9, endBar: 16, name: "drop" }];
    expect(rulerBlocks({ mode: "song", parts }, 16)).toEqual(parts);
  });
});
