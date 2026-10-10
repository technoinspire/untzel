// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { areSessionActionsAvailable, saveStateLabel } from "./top-bar";
describe("areSessionActionsAvailable", () => {
  it("Export acts only on the running session", () => {
    expect(areSessionActionsAvailable("running")).toBe(true);
  });
  it("it is inert on the waiting, loading and failure screens", () => {
    for (const phase of ["idle", "loading", "load-failed", "unsupported"] as const) {
      expect(areSessionActionsAvailable(phase), phase).toBe(false);
    }
  });
});
describe("saveStateLabel", () => {
  it("says Saved, Saving… or why it cannot save, and nothing before the first save", () => {
    expect(saveStateLabel("saved")).toBe("Saved");
    expect(saveStateLabel("saving")).toBe("Saving…");
    expect(saveStateLabel("blocked")).toBe("Saving is blocked in this browser");
    expect(saveStateLabel(null)).toBe("");
  });
});
