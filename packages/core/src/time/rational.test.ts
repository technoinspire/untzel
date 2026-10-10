// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  add,
  compare,
  denominator,
  div,
  floor,
  fromDecimal,
  max,
  min,
  mul,
  numerator,
  rational,
  sub,
  toNumber,
  type Rational,
} from "./rational";

const integer = fc.bigInt({ min: -10_000n, max: 10_000n });
const positive = fc.bigInt({ min: 1n, max: 10_000n });
const anyRational = fc.tuple(integer, positive).map(([n, d]) => rational(n, d));
const nonZero = anyRational.filter((value) => numerator(value) !== 0n);

function same(a: Rational, b: Rational): boolean {
  return numerator(a) === numerator(b) && denominator(a) === denominator(b);
}

describe("rational", () => {
  it("normalizes sign and common factors", () => {
    const value = rational(6n, -4n);
    expect([numerator(value), denominator(value)]).toEqual([-3n, 2n]);
    const zero = rational(0n, -7n);
    expect([numerator(zero), denominator(zero)]).toEqual([0n, 1n]);
  });

  it("rejects a zero denominator and division by zero", () => {
    expect(() => rational(1n, 0n)).toThrow(RangeError);
    expect(() => div(rational(1n, 2n), rational(0n, 1n))).toThrow(RangeError);
  });

  it("survives structuredClone", () => {
    const clone = structuredClone(rational(3n, 25n));
    expect(same(clone, rational(3n, 25n))).toBe(true);
  });

  it("keeps addition and multiplication associative", () => {
    fc.assert(
      fc.property(anyRational, anyRational, anyRational, (a, b, c) => {
        expect(same(add(add(a, b), c), add(a, add(b, c)))).toBe(true);
        expect(same(mul(mul(a, b), c), mul(a, mul(b, c)))).toBe(true);
      }),
    );
  });

  it("has inverses", () => {
    fc.assert(
      fc.property(anyRational, nonZero, (a, b) => {
        expect(same(sub(add(a, b), b), a)).toBe(true);
        expect(same(div(mul(a, b), b), a)).toBe(true);
      }),
    );
  });

  it("orders consistently with sub", () => {
    fc.assert(
      fc.property(anyRational, anyRational, (a, b) => {
        expect(compare(a, b)).toBe(Math.sign(Number(numerator(sub(a, b)))));
        expect(compare(min(a, b), max(a, b))).toBeLessThanOrEqual(0);
      }),
    );
  });

  it("floors toward negative infinity", () => {
    expect(floor(rational(7n, 2n))).toBe(3n);
    expect(floor(rational(-7n, 2n))).toBe(-4n);
    expect(floor(rational(-4n, 2n))).toBe(-2n);
    fc.assert(
      fc.property(anyRational, (a) => {
        const f = rational(floor(a), 1n);
        expect(compare(f, a)).toBeLessThanOrEqual(0);
        expect(compare(add(f, rational(1n, 1n)), a)).toBe(1);
      }),
    );
  });

  it("parses decimals exactly", () => {
    expect(same(fromDecimal("0.12") as Rational, rational(3n, 25n))).toBe(true);
    expect(same(fromDecimal("-1.5") as Rational, rational(-3n, 2n))).toBe(true);
    expect(same(fromDecimal("132") as Rational, rational(132n, 1n))).toBe(true);
    for (const invalid of ["", "1.", ".5", "1e3", "abc", "--1", "1.2.3"]) {
      expect(fromDecimal(invalid)).toBeNull();
    }
  });

  it("round-trips decimals", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), fc.integer({ min: 0, max: 6 }), (digits, places) => {
        const text = (digits / 10 ** places).toFixed(places);
        const parsed = fromDecimal(text);
        expect(parsed).not.toBeNull();
        expect(toNumber(parsed as Rational)).toBeCloseTo(Number(text), 9);
      }),
    );
  });

  it("converts to number", () => {
    expect(toNumber(rational(1n, 3n))).toBeCloseTo(1 / 3, 15);
    expect(toNumber(rational(-7n, 2n))).toBe(-3.5);
  });
});
