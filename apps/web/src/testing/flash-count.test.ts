// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { luminanceTransitions, worstFlashesPerSecond } from "./flash-count";
const FPS = 60;
/** A square wave between `low` and `high`, `perSecond` full cycles a second, for `seconds`. */
function square(low: number, high: number, perSecond: number, seconds = 3): number[] {
  return Array.from({ length: seconds * FPS }, (_, index) => (Math.floor((index / FPS) * perSecond * 2) % 2 === 0 ? low : high));
}
describe("flash count (WCAG general flash)", () => {
  it("counts each up-and-down pair of 0.10 or more as one flash", () => {
    expect(worstFlashesPerSecond(square(0.1, 0.3, 2), FPS)).toBe(2);
    expect(worstFlashesPerSecond(square(0.1, 0.3, 5), FPS)).toBe(5);
  });
  it("ignores changes under 0.10 and changes whose darker state is 0.80 or above", () => {
    expect(worstFlashesPerSecond(square(0.1, 0.19, 5), FPS)).toBe(0);
    expect(worstFlashesPerSecond(square(0.85, 0.98, 5), FPS)).toBe(0);
  });
  it("needs opposing changes: a slow climb is one transition, not a flash", () => {
    const climb = Array.from({ length: 3 * FPS }, (_, index) => index / (3 * FPS));
    expect(luminanceTransitions(climb)).toHaveLength(1);
    expect(worstFlashesPerSecond(climb, FPS)).toBe(0);
  });
});
