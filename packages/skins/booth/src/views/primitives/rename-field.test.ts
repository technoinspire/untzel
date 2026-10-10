// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { renameKeyAction } from "./rename-field";
describe("renameKeyAction", () => {
  it("commits on Enter and cancels on Esc", () => {
    expect(renameKeyAction("Enter")).toBe("commit");
    expect(renameKeyAction("Escape")).toBe("cancel");
  });
  it("lets every other key type, Space and the shortcuts included", () => {
    for (const key of [" ", "h", "H", "Tab", "ArrowLeft"]) expect(renameKeyAction(key), key).toBeNull();
  });
});
