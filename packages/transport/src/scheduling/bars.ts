// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { denominator, floor, mul, numerator, rational, sub, type Rational } from "@untzel/core";

// Integer bar helpers over core's Rational. Integer bars (boundaries) are plain numbers:
// 2^53 bars is far beyond any session.

const ZERO = rational(0n, 1n);

export function wholeBar(bar: number): Rational {
  return rational(BigInt(bar), 1n);
}

export function floorBar(value: Rational): number {
  return Number(floor(value));
}

/** Smallest integer not less than value. */
export function ceilBar(value: Rational): number {
  return -Number(floor(sub(ZERO, value)));
}

/** The first multiple of 1/steps of a bar not before value. */
export function ceilStep(value: Rational, steps: number): Rational {
  return rational(BigInt(ceilBar(mul(value, rational(BigInt(steps), 1n)))), BigInt(steps));
}
/** The integer bar when value is a bar boundary, null otherwise. */
export function boundaryOf(value: Rational): number | null {
  return denominator(value) === 1n ? Number(numerator(value)) : null;
}
