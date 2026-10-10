// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import {
  BELOW_FLOOR_POSITION,
  dbToPosition,
  formatDb,
  gainLabel,
  gainToDb,
  gainToPosition,
  positionToDb,
  positionToGain,
  stepGain,
} from "./fader-law";

describe("the gain fader law", () => {
  it("puts Off at 0, −60 dB just above, −20 dB at 25 %, 0 dB at 75 % and +6 dB at the top", () => {
    expect(positionToDb(0)).toBeNull();
    expect(positionToDb(1e-9)).toBeCloseTo(-60, 5);
    expect(positionToDb(0.25)).toBeCloseTo(-20, 9);
    expect(positionToDb(0.75)).toBeCloseTo(0, 9);
    expect(positionToDb(1)).toBeCloseTo(6, 9);
  });

  it("is linear in dB between −20 and 0 dB", () => {
    expect(positionToDb(0.5)).toBeCloseTo(-10, 9);
    expect(positionToDb(0.6)).toBeCloseTo(-6, 9);
  });

  it("writes gain 1 at 0 dB, 0.501 at −6 dB, 0 at Off, three decimals", () => {
    expect(positionToGain(0.75)).toBe(1);
    expect(positionToGain(0.6)).toBe(0.501);
    expect(positionToGain(0)).toBe(0);
    expect(positionToGain(1)).toBe(1.995);
  });

  it("round trips gain → position → the identical gain for every written gain from 0.001 to 2", () => {
    for (let thousandths = 1; thousandths <= 2000; thousandths += 1) {
      const gain = thousandths / 1000;
      expect(positionToGain(gainToPosition(gain))).toBe(Math.min(gain, 1.995));
    }
    expect(positionToGain(gainToPosition(0))).toBe(0);
  });

  it("round trips position → gain → position within 0.5 dB from −40 dB up", () => {
    for (let index = 0; index <= 400; index += 1) {
      const position = 0.125 + (index / 400) * 0.875;
      const db = positionToDb(position) ?? 0;
      const back = positionToDb(gainToPosition(positionToGain(position))) ?? 0;
      expect(Math.abs(back - db)).toBeLessThan(0.5);
    }
  });

  it("places a gain written under the floor just above Off and reads its real level", () => {
    expect(gainToPosition(0.0005)).toBe(BELOW_FLOOR_POSITION);
    expect(gainLabel(0.0005)).toBe("\u221266.0 dB");
    expect(dbToPosition(null)).toBe(0);
  });

  it("labels in dB with one decimal and the typographic minus", () => {
    expect(gainLabel(1)).toBe("0.0 dB");
    expect(gainLabel(0.501)).toBe("\u22126.0 dB");
    expect(gainLabel(1.5)).toBe("+3.5 dB");
    expect(gainLabel(0)).toBe("Off");
    expect(formatDb(-0.04)).toBe("0.0 dB");
    expect(gainToDb(0)).toBeNull();
  });

  it("moves 0.5 dB per arrow, from Off up to −60 dB and from −60 dB down to Off", () => {
    expect(gainLabel(stepGain(1, -1))).toBe("\u22120.5 dB");
    expect(gainLabel(stepGain(1, 2))).toBe("+1.0 dB");
    expect(stepGain(0, 1)).toBe(0.001);
    expect(stepGain(0.001, -1)).toBe(0);
    expect(stepGain(0, -1)).toBe(0);
    expect(stepGain(1.995, 1)).toBe(1.995);
    // A hand-written gain 2 sits above the +6 dB top: up keeps it, down moves 0.5 dB.
    expect(stepGain(2, 1)).toBe(2);
    expect(gainLabel(stepGain(2, -1))).toBe("+5.5 dB");
  });

  it("never sticks near the floor, where three decimals are coarser than 0.5 dB", () => {
    expect(stepGain(0.002, -1)).toBe(0.001);
    expect(stepGain(0.001, 1)).toBe(0.002);
  });
});
