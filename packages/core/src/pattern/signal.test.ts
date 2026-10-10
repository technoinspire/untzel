// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { rational } from "../time/rational";
import { interp, signalAt, type SignalShape, type SignalValue } from "./signal";

function signal(shape: SignalShape, overrides: Partial<SignalValue> = {}): SignalValue {
  return {
    kind: "signal",
    signal: { shape, periodBars: rational(4n, 1n) },
    low: 0,
    high: 1,
    from: 0,
    to: 1,
    curve: "linear",
    ...overrides,
  };
}

const noRandom = (): number => {
  throw new Error("rand only");
};

describe("interp", () => {
  it("interpolates linearly and exponentially", () => {
    expect(interp("linear", 300, 1400, 0.5)).toBe(850);
    expect(interp("exponential", 300, 1400, 0.5)).toBeCloseTo(648.074, 3);
    expect(interp("exponential", 300, 1400, 0)).toBe(300);
  });
});

describe("signalAt", () => {
  it("sweeps in the parameter curve domain", () => {
    const cutoff = signal("sine", {
      signal: { shape: "sine", periodBars: rational(8n, 1n) },
      from: 300,
      to: 1400,
      curve: "exponential",
    });
    expect(signalAt(cutoff, rational(2n, 1n), noRandom)).toBeCloseTo(648.07, 2);
    expect(signalAt({ ...cutoff, curve: "linear" }, rational(2n, 1n), noRandom)).toBeCloseTo(850, 9);
    expect(signalAt(cutoff, rational(0n, 1n), noRandom)).toBe(300);
    expect(signalAt(cutoff, rational(4n, 1n), noRandom)).toBeCloseTo(1400, 9);
  });

  it("draws every shape", () => {
    const at = (shape: SignalShape, bars: bigint): number =>
      signalAt(signal(shape), rational(bars, 1n), () => 0.25);
    expect(at("tri", 1n)).toBe(0.5);
    expect(at("tri", 3n)).toBe(0.5);
    expect(at("saw", 3n)).toBe(0.75);
    expect(at("square", 1n)).toBe(0);
    expect(at("square", 2n)).toBe(1);
    expect(at("saw", 4n)).toBe(0);
    expect(at("rand", 1n)).toBe(0.25);
  });

  it("maps the shape into low..high before the curve", () => {
    const tone = signal("saw", { low: 0.2, high: 0.8, from: 120, to: 3000, curve: "exponential" });
    expect(signalAt(tone, rational(0n, 1n), noRandom)).toBeCloseTo(120 * Math.pow(25, 0.2), 9);
  });

  it("asks rand for the period index", () => {
    const periods: number[] = [];
    signalAt(signal("rand"), rational(9n, 1n), (period) => {
      periods.push(period);
      return 0;
    });
    expect(periods).toEqual([2]);
  });
});
