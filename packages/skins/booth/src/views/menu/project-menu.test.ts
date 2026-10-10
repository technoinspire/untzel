// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { menuItemClass, trailingKind } from "./project-menu";
describe("the menu's rows", () => {
  it("are taller with a hint and mark Delete as danger", () => {
    expect(menuItemClass({ hint: null, isDanger: false })).toBe("ui-menu__item");
    expect(menuItemClass({ hint: "You can undo for 10 s", isDanger: true })).toBe("ui-menu__item ui-menu__item--tall ui-menu__item--danger");
  });
  it("end with a switch, the language's check or the new-tab arrow", () => {
    expect(trailingKind({ switchLabel: "On", role: "menuitemcheckbox", href: null })).toBe("switch");
    expect(trailingKind({ switchLabel: null, role: "menuitemradio", href: null })).toBe("check");
    expect(trailingKind({ switchLabel: null, role: "menuitem", href: "/untzel/docs/" })).toBe("external");
    expect(trailingKind({ switchLabel: null, role: "menuitem", href: null })).toBeNull();
  });
});
