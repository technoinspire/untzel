// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { meterValue } from "./cpu-meter";
describe("meterValue", () => {
  it("fills the meter with the load and speaks it as a rounded percentage", () => {
    expect(meterValue(0.426)).toEqual({ fill: 0.426, percent: 43 });
  });
  it("clamps a load outside 0 to 1", () => {
    expect(meterValue(1.7)).toEqual({ fill: 1, percent: 100 });
    expect(meterValue(-0.2)).toEqual({ fill: 0, percent: 0 });
  });
});
