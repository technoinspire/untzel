// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { TOP_BAR_PX, popoverPosition } from "./popover-position";

const viewport = { width: 1440, height: 900 };
const popover = { width: 420, height: 200 };

describe("popoverPosition", () => {
  it("opens under the chip, 8 px below it", () => {
    expect(popoverPosition({ left: 438, top: 436, bottom: 480 }, popover, viewport)).toEqual({ left: 438, top: 488 });
  });

  it("stays inside the window on the right", () => {
    expect(popoverPosition({ left: 1300, top: 100, bottom: 144 }, popover, viewport).left).toBe(1004);
  });

  it("opens above the chip when there is no room below", () => {
    expect(popoverPosition({ left: 32, top: 800, bottom: 844 }, popover, viewport).top).toBe(592);
  });
  it("never covers the brand mark when it opens above (the key picker)", () => {
    expect(popoverPosition({ left: 90, top: 440, bottom: 462 }, { width: 420, height: 470 }, viewport, TOP_BAR_PX).top).toBe(TOP_BAR_PX);
  });
});
