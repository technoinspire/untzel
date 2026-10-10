// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compare, floor, mul, rational, toNumber, type Rational } from "./rational";
import { applySwing } from "./swing";

const swingAmount = fc.integer({ min: 0, max: 50 }).map((value) => rational(BigInt(value), 100n));
const onset = fc
  .tuple(fc.bigInt({ min: 0n, max: 4_000n }), fc.bigInt({ min: 1n, max: 96n }))
  .map(([n, d]) => rational(n, d));

function beatOf(value: Rational): bigint {
  return floor(mul(value, rational(4n, 1n)));
}

describe("applySwing", () => {
  it("puts the even eighth at 62.5% and 75% of the beat", () => {
    const evenEighth = rational(1n, 8n);
    expect(toNumber(applySwing(evenEighth, rational(1n, 4n))) / 0.25).toBe(0.625);
    expect(toNumber(applySwing(evenEighth, rational(1n, 2n))) / 0.25).toBe(0.75);
    expect(toNumber(applySwing(rational(9n, 8n), rational(1n, 2n)))).toBe(1 + 3 / 16);
  });

  it("does nothing without swing and keeps beat starts", () => {
    expect(compare(applySwing(rational(3n, 16n), rational(0n, 1n)), rational(3n, 16n))).toBe(0);
    expect(compare(applySwing(rational(3n, 4n), rational(1n, 2n)), rational(3n, 4n))).toBe(0);
  });

  it("is monotonic and never leaves the beat", () => {
    fc.assert(
      fc.property(onset, onset, swingAmount, (a, b, swing) => {
        const [first, second] = compare(a, b) <= 0 ? [a, b] : [b, a];
        expect(compare(applySwing(first, swing), applySwing(second, swing))).toBeLessThanOrEqual(0);
        expect(beatOf(applySwing(first, swing))).toBe(beatOf(first));
      }),
    );
  });
});
