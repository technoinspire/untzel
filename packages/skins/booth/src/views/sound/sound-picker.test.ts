// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { soundOfOption } from "./sound-picker";
describe("soundOfOption", () => {
  it("writes no sound for the default, the first option", () => {
    expect(soundOfOption(0, "classic")).toBeNull();
  });
  it("writes the name of any other sound", () => {
    expect(soundOfOption(2, "warm")).toBe("warm");
  });
});
