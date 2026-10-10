// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { modeControls } from "./transport-bar";
describe("modeControls", () => {
  it("shows the Length chip in loop mode and keeps Drop live", () => {
    expect(modeControls("loop")).toEqual({ showsLength: true, isDropDisabled: false });
  });
  it("hides the Length chip in song mode and makes Drop inert", () => {
    expect(modeControls("song")).toEqual({ showsLength: false, isDropDisabled: true });
  });
});
