// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { menuKey } from "./menu-keyboard";
const LABELS = ["New project…", "Open project…", "Rename song", "Duplicate", "Documentation"];
describe("menuKey", () => {
  it("the arrows walk the list and wrap", () => {
    expect(menuKey("ArrowDown", 0, LABELS)).toEqual({ kind: "focus", index: 1 });
    expect(menuKey("ArrowDown", 4, LABELS)).toEqual({ kind: "focus", index: 0 });
    expect(menuKey("ArrowUp", 0, LABELS)).toEqual({ kind: "focus", index: 4 });
  });
  it("Home and End go to the ends", () => {
    expect(menuKey("Home", 3, LABELS)).toEqual({ kind: "focus", index: 0 });
    expect(menuKey("End", 0, LABELS)).toEqual({ kind: "focus", index: 4 });
  });
  it("a letter jumps to the next item starting with it, and wraps", () => {
    expect(menuKey("d", 0, LABELS)).toEqual({ kind: "focus", index: 3 });
    expect(menuKey("D", 3, LABELS)).toEqual({ kind: "focus", index: 4 });
    expect(menuKey("n", 4, LABELS)).toEqual({ kind: "focus", index: 0 });
    expect(menuKey("z", 0, LABELS)).toEqual({ kind: "none" });
  });
  it("Esc closes, Tab leaves, other keys do nothing", () => {
    expect(menuKey("Escape", 2, LABELS)).toEqual({ kind: "close" });
    expect(menuKey("Tab", 2, LABELS)).toEqual({ kind: "leave" });
    expect(menuKey("Shift", 2, LABELS)).toEqual({ kind: "none" });
    expect(menuKey(" ", 2, LABELS)).toEqual({ kind: "none" });
  });
});
