// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { strings } from "../../copy/copy";
import { timeLeftText } from "./export-progress";
describe("timeLeftText", () => {
  it("says the time left once there is an estimate", () => {
    expect(timeLeftText(12)).toBe(strings.secondsLeft(12));
    expect(timeLeftText(12)).not.toBe("");
  });
  it("says nothing before the first estimate", () => {
    expect(timeLeftText(null)).toBe("");
  });
});
