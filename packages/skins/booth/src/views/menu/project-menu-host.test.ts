// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The host's DOM (sheet or popover, redraw in place with the focus kept) is covered by
// tests/skins/booth/parallel/library/project-menu.browser.ts in the real shell; here, its one presentation rule.
import { describe, expect, it } from "vitest";
import { menuSheetHeading } from "./project-menu-host";
describe("menuSheetHeading", () => {
  it("repeats the song title, or says Menu with no project", () => {
    expect(menuSheetHeading("Midnight Coast")).toBe("Midnight Coast");
    expect(menuSheetHeading(null)).toBe("Menu");
  });
});
