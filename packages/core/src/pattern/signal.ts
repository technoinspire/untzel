// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { div, floor, rational, sub, toNumber, type Rational } from "../time/rational";

/** Signal shapes, as values so the docs can list them; the grammar has the same keywords. */
export const SIGNAL_SHAPES = ["sine", "tri", "saw", "square", "rand"] as const;
export type SignalShape = (typeof SIGNAL_SHAPES)[number];
export type Curve = "linear" | "exponential";
export interface Signal {
  readonly shape: SignalShape;
  readonly periodBars: Rational;
}
/** A parameter driven by a signal, in the domain of the parameter curve. */
export interface SignalValue {
  readonly kind: "signal";
  readonly signal: Signal;
  /** Position 0..1 where the signal starts. */
  readonly low: number;
  /** Position 0..1 at the signal peak. */
  readonly high: number;
  /** Parameter value at position 0. */
  readonly from: number;
  /** Parameter value at position 1. */
  readonly to: number;
  readonly curve: Curve;
}

/** Linear from + (to - from) * x, or exponential from * (to / from) ^ x. */
export function interp(curve: Curve, from: number, to: number, x: number): number {
  if (curve === "exponential") return from * Math.pow(to / from, x);
  return from + (to - from) * x;
}
/** Inverse of interp: where `value` sits between `from` and `to`, clamped to 0..1. */
export function curvePosition(curve: Curve, from: number, to: number, value: number): number {
  const position =
    curve === "exponential" && from > 0 && to > 0 && value > 0
      ? Math.log(value / from) / Math.log(to / from)
      : (value - from) / (to - from);
  return Number.isFinite(position) ? Math.min(1, Math.max(0, position)) : 0;
}

function shapeAt(shape: SignalShape, phase: number, random: () => number): number {
  switch (shape) {
    case "sine":
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    case "tri":
      return phase < 0.5 ? 2 * phase : 2 - 2 * phase;
    case "saw":
      return phase;
    case "square":
      return phase < 0.5 ? 0 : 1;
    case "rand":
      return random();
  }
}

/**
 * Parameter value of a signal at a phase in bars. `randomAt(periodIndex)` supplies u
 * for the rand shape (randomSignalDraw bound to the program hash and the track).
 */
export function signalAt(
  value: SignalValue,
  phaseBars: Rational,
  randomAt: (periodIndex: number) => number,
): number {
  const periods = div(phaseBars, value.signal.periodBars);
  const periodIndex = floor(periods);
  const phase = toNumber(sub(periods, rational(periodIndex, 1n)));
  const shape = shapeAt(value.signal.shape, phase, () => randomAt(Number(periodIndex)));
  const position = value.low + (value.high - value.low) * shape;
  return interp(value.curve, value.from, value.to, position);
}
