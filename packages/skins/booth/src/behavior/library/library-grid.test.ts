// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import {
  GRID_ATTRIBUTES,
  LIBRARY_GRID_ID,
  ROW_ATTRIBUTES,
  STATUS_ATTRIBUTES,
  activeDescendant,
  cellAttributes,
  comboboxAttributes,
  nameCellId,
} from "./library-grid";
import { auditionAnnouncement } from "./library-labels";

describe("library roles", () => {
  it("the search is a combobox that controls the grid of instruments", () => {
    const search = comboboxAttributes(64);
    expect(search["role"]).toBe("combobox");
    expect(search["aria-haspopup"]).toBe("grid");
    expect(search["aria-controls"]).toBe(LIBRARY_GRID_ID);
    expect(GRID_ATTRIBUTES["id"]).toBe(LIBRARY_GRID_ID);
    expect(GRID_ATTRIBUTES["role"]).toBe("grid");
  });

  it("rows hold gridcells, never options of a listbox", () => {
    const roles = [GRID_ATTRIBUTES["role"], ROW_ATTRIBUTES["role"], cellAttributes()["role"], cellAttributes("x")["role"]];
    expect(roles).toEqual(["grid", "row", "gridcell", "gridcell"]);
    expect(roles).not.toContain("option");
    expect(roles).not.toContain("listbox");
  });

  it("the active row is named by its name cell's id", () => {
    expect(cellAttributes(nameCellId("piano"))["id"]).toBe("ui-library-row-piano");
    expect(activeDescendant(["pad", "piano"], 1)).toBe(nameCellId("piano"));
    expect(activeDescendant([], 0)).toBeNull();
  });
});

describe("library status region", () => {
  it("is a polite status that announces the audition start and end", () => {
    expect(STATUS_ATTRIBUTES).toEqual({ role: "status" });
    const grand = { instrument: "piano", sound: "grand", key: "c minor", pattern: null };
    const texts = [auditionAnnouncement(null, grand), auditionAnnouncement(grand, grand), auditionAnnouncement(grand, null)];
    expect(texts).toEqual(["Playing piano, grand", null, "Preview stopped"]);
  });
});
