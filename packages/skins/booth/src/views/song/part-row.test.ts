// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { partRowLabel } from "./part-row";
describe("partRowLabel", () => {
  it("names the part alone outside a play range", () => {
    expect(partRowLabel("drop, 8 bars", null)).toBe("drop, 8 bars");
  });
  it("adds the part's place in the play range", () => {
    expect(partRowLabel("drop, 8 bars", "range start")).toBe("drop, 8 bars, range start");
  });
});
