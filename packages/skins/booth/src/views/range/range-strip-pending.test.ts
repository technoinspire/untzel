// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { isOtherRuler } from "./range-strip-pending";
describe("isOtherRuler", () => {
  it("is another ruler when the mode or the length changes", () => {
    expect(isOtherRuler({ mode: "loop", lastBar: 8 }, { mode: "song", lastBar: 8 })).toBe(true);
    expect(isOtherRuler({ mode: "loop", lastBar: 8 }, { mode: "loop", lastBar: 4 })).toBe(true);
  });
  it("is the same ruler on a new view of it, and on the first view", () => {
    expect(isOtherRuler({ mode: "loop", lastBar: 8 }, { mode: "loop", lastBar: 8 })).toBe(false);
    expect(isOtherRuler(null, { mode: "song", lastBar: 56 })).toBe(false);
  });
});
