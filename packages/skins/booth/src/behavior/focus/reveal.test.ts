// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { revealDelta } from "./reveal";

describe("revealDelta", () => {
  const box = { top: 100, bottom: 780 };

  it("leaves an item that shows whole where it is", () => {
    expect(revealDelta({ top: 300, bottom: 700 }, box)).toBe(0);
  });

  it("scrolls down just enough for an item cut at the bottom (Choose under the footer)", () => {
    expect(revealDelta({ top: 420, bottom: 820 }, box)).toBe(40);
  });

  it("scrolls up for an item above the box", () => {
    expect(revealDelta({ top: 60, bottom: 400 }, box)).toBe(-40);
  });

  it("shows a taller item from its top", () => {
    expect(revealDelta({ top: 300, bottom: 1200 }, box)).toBe(200);
  });
});
