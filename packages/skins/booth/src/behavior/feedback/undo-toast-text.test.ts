// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { undoToastText } from "./undo-toast-text";

describe("undoToastText", () => {
  it("names what was undone and where", () => {
    expect(undoToastText("undo", { what: "gain", target: "hat" })).toBe("Undid: gain on hat");
    expect(undoToastText("redo", { what: "gain", target: "hat" })).toBe("Redid: gain on hat");
    expect(undoToastText("undo", { what: "tempo", target: null })).toBe("Undid: tempo");
  });

  it("reads gestures on a whole track as actions", () => {
    expect(undoToastText("undo", { what: "rename", target: "hats" })).toBe("Undid: renaming to hats");
    expect(undoToastText("undo", { what: "add", target: "kick" })).toBe("Undid: adding kick");
  });

  it("falls back to the last change for typing", () => {
    expect(undoToastText("undo", null)).toBe("Undid: the last change");
  });
});
