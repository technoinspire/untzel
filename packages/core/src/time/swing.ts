// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { add, compare, div, floor, mul, rational, sub, type Rational } from "./rational";

const BEAT = rational(1n, 4n);
const EIGHTH = rational(1n, 8n);
const ZERO = rational(0n, 1n);

/**
 * Piecewise-linear, monotonic warp of an onset inside each beat (1/4 bar), with
 * d = swing x 1/8: [0, 1/8) -> [0, 1/8 + d), [1/8, 1/4) -> [1/8 + d, 1/4).
 */
export function applySwing(begin: Rational, swing: Rational): Rational {
  if (compare(swing, ZERO) === 0) return begin;
  const beatStart = mul(rational(floor(div(begin, BEAT)), 1n), BEAT);
  const position = sub(begin, beatStart);
  const delay = mul(swing, EIGHTH);
  const split = add(EIGHTH, delay);
  const warped =
    compare(position, EIGHTH) < 0
      ? mul(position, div(split, EIGHTH))
      : add(split, mul(sub(position, EIGHTH), div(sub(EIGHTH, delay), EIGHTH)));
  return add(beatStart, warped);
}
