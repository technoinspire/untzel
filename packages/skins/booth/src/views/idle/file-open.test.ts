// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { acceptsDrop } from "./file-open";

describe("acceptsDrop", () => {
  it("takes files on the waiting stage and while running", () => {
    expect(acceptsDrop("idle", ["Files"])).toBe(true);
    expect(acceptsDrop("running", ["text/uri-list", "Files"])).toBe(true);
  });

  it("refuses text drags and the loading and failure screens", () => {
    expect(acceptsDrop("running", ["text/plain"])).toBe(false);
    expect(acceptsDrop("running", undefined)).toBe(false);
    expect(acceptsDrop("loading", ["Files"])).toBe(false);
    expect(acceptsDrop("load-failed", ["Files"])).toBe(false);
  });
});
