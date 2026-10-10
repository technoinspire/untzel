// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { menuButtonAttributes } from "./menu-button";
describe("menuButtonAttributes", () => {
  it("is a WAI-ARIA menu button that says whether its menu is open", () => {
    expect(menuButtonAttributes(false, "ui-menu")).toEqual({ "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": "ui-menu" });
    expect(menuButtonAttributes(true, "ui-menu")["aria-expanded"]).toBe("true");
  });
});
