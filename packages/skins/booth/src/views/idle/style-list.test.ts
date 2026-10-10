// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { styleListState } from "./style-list";
import type { StyleOption } from "./template-picker-model";

const styles: readonly StyleOption[] = [
  { id: "amapiano", label: "Amapiano · 1 project", isOpen: false },
  { id: "house", label: "House · 3 projects", isOpen: true },
];

describe("styleListState", () => {
  it("hides an empty list and selects nothing", () => {
    expect(styleListState([], "house")).toEqual({ value: "", isHidden: true });
  });
  it("shows the open style", () => {
    expect(styleListState(styles, "house")).toEqual({ value: "house", isHidden: false });
  });
  it("falls back to the first style when the open one is not listed", () => {
    expect(styleListState(styles, "polka")).toEqual({ value: "amapiano", isHidden: false });
  });
});
