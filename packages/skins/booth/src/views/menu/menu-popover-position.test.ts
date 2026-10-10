// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { menuPopoverPosition } from "./menu-popover-position";
const viewport = { width: 1440, height: 900 };
describe("menuPopoverPosition", () => {
  it("aligns its right edge with the button's and opens 12 px under it", () => {
    expect(menuPopoverPosition({ right: 944, top: 16, bottom: 60 }, { width: 640, height: 600 }, viewport)).toEqual({ left: 304, top: 72 });
  });
  it("opens 12 px above when there is no room under", () => {
    expect(menuPopoverPosition({ right: 944, top: 700, bottom: 744 }, { width: 640, height: 600 }, viewport)).toEqual({ left: 304, top: 88 });
  });
  it("stays 16 px from every edge", () => {
    expect(menuPopoverPosition({ right: 400, top: 16, bottom: 60 }, { width: 640, height: 600 }, viewport).left).toBe(16);
    expect(menuPopoverPosition({ right: 1500, top: 16, bottom: 60 }, { width: 640, height: 600 }, viewport).left).toBe(784);
    expect(menuPopoverPosition({ right: 944, top: 300, bottom: 344 }, { width: 640, height: 880 }, viewport).top).toBe(16);
  });
});
