// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { PANEL_TABS, isTabStripShown, visiblePanelTabs } from "./side-panel";
describe("the side panel's tabs", () => {
  it("are Track and Part; the code is no tab", () => {
    expect(PANEL_TABS).toEqual(["track", "part"]);
  });
  it("offer Part in song mode only", () => {
    expect(visiblePanelTabs(true)).toEqual(["track", "part"]);
    expect(visiblePanelTabs(false)).toEqual(["track"]);
  });
  it("hide as a strip when Track would be alone (loop mode)", () => {
    expect(isTabStripShown(true)).toBe(true);
    expect(isTabStripShown(false)).toBe(false);
  });
});
