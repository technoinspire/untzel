// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { normalizeRanges } from "./decorations";

describe("normalizeRanges", () => {
  it("clamps, sorts and merges overlapping ranges", () => {
    expect(normalizeRanges([{ from: 8, to: 12 }, { from: -2, to: 3 }, { from: 10, to: 14 }, { from: 20, to: 40 }, { from: 5, to: 5 }], 30))
      .toEqual([{ from: 0, to: 3 }, { from: 8, to: 14 }, { from: 20, to: 30 }]);
  });
});
