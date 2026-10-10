// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { MUSICAL_LENGTHS, editingLabel, stepLength, stepRowsCaption } from "./lengths";

describe("lengths", () => {
  it("offers the musical lengths and steps between them, odd lengths included", () => {
    expect(MUSICAL_LENGTHS).toEqual([1, 2, 4, 8, 16]);
    expect(stepLength(4, 1)).toBe(8);
    expect(stepLength(4, -1)).toBe(2);
    expect(stepLength(6, -1)).toBe(4);
    expect(stepLength(6, 1)).toBe(8);
    expect(stepLength(16, 1)).toBeNull();
    expect(stepLength(1, -1)).toBeNull();
  });

  it("says which bar is edited and which steps the grid rows hold", () => {
    expect(editingLabel(1, 4)).toBe("Editing bar 2 of 4");
    expect(stepRowsCaption(16, 1)).toBe("steps 1–8 · 9–16 of bar 2");
    expect(stepRowsCaption(8, 0)).toBe("steps 1–8 of bar 1");
    expect(stepRowsCaption(32, 3)).toBe("steps 1–8 · 9–16 · 17–24 · 25–32 of bar 4");
    expect(stepRowsCaption(6, 0)).toBe("steps 1–6 of bar 1");
  });
});
