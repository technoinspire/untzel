// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { partsKey } from "./export-range";

describe("partsKey", () => {
  it("changes when a part is renamed, added or moved, so From and To are rebuilt", () => {
    const parts = [
      { index: 0, label: "1 · intro · 8 bars" },
      { index: 1, label: "2 · build · 4 bars" },
    ];
    const key = partsKey(parts);
    expect(partsKey(parts.map((part) => ({ ...part })))).toBe(key);
    expect(partsKey([parts[0]!, { index: 1, label: "2 · drop · 4 bars" }])).not.toBe(key);
    expect(partsKey([...parts, { index: 2, label: "3 · drop · 16 bars" }])).not.toBe(key);
    expect(partsKey([])).toBe("");
  });
});
