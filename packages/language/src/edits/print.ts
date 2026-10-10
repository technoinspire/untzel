// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** Decimal places kept when a gesture writes a number into the text. */
const MAX_DECIMALS = 4;

/**
 * Prints a number the way the grammar reads it back ("-"? digits ("." digits)?), with at
 * most four decimals and no trailing zeros. Null for NaN and infinities.
 * Idempotent: printing the value read from a printed number gives the same text.
 */
export function printNumber(value: number): string | null {
  // toFixed switches to exponent notation from 1e21 on, which the grammar cannot read.
  if (!Number.isFinite(value) || Math.abs(value) >= 1e21) return null;
  const fixed = value.toFixed(MAX_DECIMALS);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return trimmed === "-0" ? "0" : trimmed;
}
