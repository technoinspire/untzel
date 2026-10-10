// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { isScrollFirst } from "./sheet-drag-to-close";
describe("isScrollFirst", () => {
  it("leaves a touch that first moves up to the body's scroll", () => {
    expect(isScrollFirst(false, 90, 100)).toBe(true);
  });
  it("lets a touch that moves down drag the sheet, and keeps a drag under way", () => {
    expect(isScrollFirst(false, 110, 100)).toBe(false);
    expect(isScrollFirst(true, 90, 100)).toBe(false);
  });
});
