// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { add, div, floor, mul, rational, sub, type Rational } from "./rational";

/**
 * The single place that converts bars to frames. Every
 * frame is computed from the origin, never from the previous event, so error never
 * accumulates. A tempo change creates a new origin at a bar boundary.
 */
export interface TempoOrigin {
  readonly bar: Rational;
  readonly frame: number;
  /** bpm */
  readonly tempo: Rational;
  /** 240 × sampleRate / tempo: frames in one 4/4 bar. */
  readonly framesPerBar: Rational;
}

const QUARTERS_PER_BAR_TIMES_SECONDS = 240n;

export function createOrigin(
  bar: Rational,
  frame: number,
  tempo: Rational,
  sampleRate: number,
): TempoOrigin {
  const framesPerBar = div(
    rational(QUARTERS_PER_BAR_TIMES_SECONDS * BigInt(sampleRate), 1n),
    tempo,
  );
  return { bar, frame, tempo, framesPerBar };
}

/** frame(bar) = origin.frame + floor((bar − origin.bar) × 240 × sampleRate / tempo). */
export function frameAt(origin: TempoOrigin, bar: Rational): number {
  return origin.frame + Number(floor(mul(sub(bar, origin.bar), origin.framesPerBar)));
}

/** bar(frame) = origin.bar + (frame − origin.frame) × tempo / (240 × sampleRate), exact. */
export function barAt(origin: TempoOrigin, frame: number): Rational {
  return add(origin.bar, div(rational(BigInt(frame - origin.frame), 1n), origin.framesPerBar));
}

/** A new origin at `bar` that continues the old timeline: same frame for that bar. */
export function retempo(
  origin: TempoOrigin,
  bar: Rational,
  tempo: Rational,
  sampleRate: number,
): TempoOrigin {
  return createOrigin(bar, frameAt(origin, bar), tempo, sampleRate);
}
