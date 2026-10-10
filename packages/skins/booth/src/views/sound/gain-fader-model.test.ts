// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { GAIN_MARKS, dragPosition, faderLegend, keySteps } from "./gain-fader-model";

describe("the gain fader's presentation", () => {
  it("marks Off, −40, −20, −10, −6, 0 dB at 75 % and +6", () => {
    expect(GAIN_MARKS.map((mark) => mark.label)).toEqual(["Off", "\u221240", "\u221220", "\u221210", "\u22126", "0 dB", "+6"]);
    expect(GAIN_MARKS.find((mark) => mark.isUnity)?.position).toBe(0.75);
    expect(GAIN_MARKS.find((mark) => mark.label === "\u221220")?.position).toBe(0.25);
    expect(GAIN_MARKS.find((mark) => mark.label === "\u22126")?.position).toBeCloseTo(0.6, 9);
    expect(GAIN_MARKS.filter((mark) => mark.isWideOnly).map((mark) => mark.label)).toEqual(["\u22126"]);
  });

  it("explains the gestures for touch and for a mouse", () => {
    expect(faderLegend(true)).toBe("Double-tap for 0 dB");
    expect(faderLegend(false)).toBe("Double-click for 0 dB · Shift-drag for fine steps · arrows move 0.5 dB");
  });

  it("moves 0.5 dB per arrow and a quarter of the pointer with Shift or Alt", () => {
    expect(["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home"].map(keySteps)).toEqual([1, 1, -1, -1, null]);
    expect(dragPosition(0.5, 0.2, false)).toBeCloseTo(0.7, 9);
    expect(dragPosition(0.5, 0.2, true)).toBeCloseTo(0.55, 9);
    expect(dragPosition(0.9, 0.5, false)).toBe(1);
  });

  it("says when a gesture takes a signal out of the text", () => {
  });
});
