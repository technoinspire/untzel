// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { SWIPE_MIN_PX, swipeDirection } from "./swipe";

describe("swipeDirection", () => {
  it("a finger moving left goes to the next bar, right to the previous one", () => {
    expect(swipeDirection(-80, 10, 200)).toBe(1);
    expect(swipeDirection(80, -10, 200)).toBe(-1);
  });

  it("a short, vertical or slow drag is not a swipe", () => {
    expect(swipeDirection(-(SWIPE_MIN_PX - 1), 0, 200)).toBeNull();
    expect(swipeDirection(-80, 70, 200)).toBeNull();
    expect(swipeDirection(-80, 0, 900)).toBeNull();
  });
});
