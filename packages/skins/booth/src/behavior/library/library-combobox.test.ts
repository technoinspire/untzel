// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { comboboxAction } from "./library-combobox";

const key = (name: string, altKey = false) => ({ key: name, altKey });

describe("comboboxAction", () => {
  it("moves the active row with the arrows and wraps around", () => {
    expect(comboboxAction(key("ArrowDown"), { count: 3, active: 0 })).toEqual({ kind: "move", active: 1 });
    expect(comboboxAction(key("ArrowDown"), { count: 3, active: 2 })).toEqual({ kind: "move", active: 0 });
    expect(comboboxAction(key("ArrowUp"), { count: 3, active: 0 })).toEqual({ kind: "move", active: 2 });
  });
  it("keeps the arrows from moving the caret when nothing is shown", () => {
    expect(comboboxAction(key("ArrowDown"), { count: 0, active: 0 })).toEqual({ kind: "move", active: 0 });
  });
  it("adds with Enter and toggles the preview with Alt+Enter", () => {
    expect(comboboxAction(key("Enter"), { count: 2, active: 1 })).toEqual({ kind: "add" });
    expect(comboboxAction(key("Enter", true), { count: 2, active: 1 })).toEqual({ kind: "toggle-preview" });
  });
  it("lets every other key type, and Enter do nothing without rows", () => {
    expect(comboboxAction(key(" "), { count: 2, active: 0 })).toBeNull();
    expect(comboboxAction(key("a"), { count: 2, active: 0 })).toBeNull();
    expect(comboboxAction(key("Enter"), { count: 0, active: 0 })).toBeNull();
  });
});
