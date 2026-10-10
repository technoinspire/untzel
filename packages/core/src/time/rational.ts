// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Exact rational time. Opaque on purpose: callers use only these functions, so the
// internal representation ({ n: bigint; d: bigint }, structured-clone safe) can change
// without touching any consumer. Always normalized: d > 0n, gcd(|n|, d) = 1n, zero = 0/1.
declare const rationalBrand: unique symbol;
export interface Rational {
  readonly [rationalBrand]: true;
}

interface Representation {
  readonly n: bigint;
  readonly d: bigint;
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

function reveal(value: Rational): Representation {
  return value as unknown as Representation;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = absolute(a);
  let y = absolute(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** The only way to build a value. Throws RangeError when denominator is 0n. */
export function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new RangeError("A rational cannot have a zero denominator.");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  const representation: Representation = {
    n: (sign * numerator) / divisor,
    d: (sign * denominator) / divisor,
  };
  return representation as unknown as Rational;
}

export function numerator(value: Rational): bigint {
  return reveal(value).n;
}

export function denominator(value: Rational): bigint {
  return reveal(value).d;
}

export function add(a: Rational, b: Rational): Rational {
  const x = reveal(a);
  const y = reveal(b);
  return rational(x.n * y.d + y.n * x.d, x.d * y.d);
}

export function sub(a: Rational, b: Rational): Rational {
  const x = reveal(a);
  const y = reveal(b);
  return rational(x.n * y.d - y.n * x.d, x.d * y.d);
}

export function mul(a: Rational, b: Rational): Rational {
  const x = reveal(a);
  const y = reveal(b);
  return rational(x.n * y.n, x.d * y.d);
}

/** Throws RangeError when b is zero. */
export function div(a: Rational, b: Rational): Rational {
  const x = reveal(a);
  const y = reveal(b);
  if (y.n === 0n) throw new RangeError("Division of a rational by zero.");
  return rational(x.n * y.d, x.d * y.n);
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const x = reveal(a);
  const y = reveal(b);
  const left = x.n * y.d;
  const right = y.n * x.d;
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/** Largest integer not greater than value. */
export function floor(value: Rational): bigint {
  const { n, d } = reveal(value);
  const quotient = n / d;
  return n < 0n && quotient * d !== n ? quotient - 1n : quotient;
}

export function min(a: Rational, b: Rational): Rational {
  return compare(a, b) <= 0 ? a : b;
}

export function max(a: Rational, b: Rational): Rational {
  return compare(a, b) >= 0 ? a : b;
}

/** Exact decimal parsing: "0.12" -> 3/25, "-1.5" -> -3/2. Returns null for invalid text. */
export function fromDecimal(text: string): Rational | null {
  const match = DECIMAL.exec(text);
  if (match === null) return null;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const digits = BigInt(whole + fraction);
  const scale = 10n ** BigInt(fraction.length);
  return rational(sign === "-" ? -digits : digits, scale);
}

/** Lossy conversion, only at the audio and signal boundary. */
export function toNumber(value: Rational): number {
  const { n, d } = reveal(value);
  const whole = n / d;
  const remainder = n - whole * d;
  return Number(whole) + Number(remainder) / Number(d);
}
