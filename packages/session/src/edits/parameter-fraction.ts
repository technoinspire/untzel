// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { effectParameter, interp, positionToGain, type InstrumentManifest } from "@untzel/core";

// A slider or a drag gives a position 0..1. The text holds a value in the parameter's
// own units, rounded so the line stays readable.

/** General modifiers a slider can set, in text units. Linear, two decimals; gain is a fader in dB. */
const LINEAR_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  tone: [0, 1],
  pan: [-1, 1],
  reverb: [0, 1],
  duck: [0, 1],
};

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

/** Integers from 100 up, one decimal from 10, two below: 1 234, 12.3, 0.42. */
function readableValue(value: number): number {
  if (Math.abs(value) >= 100) return Math.round(value);
  if (Math.abs(value) >= 10) return roundTo(value, 1);
  return roundTo(value, 2);
}

/**
 * The text value of `parameter` at `fraction` (clamped to 0..1): a manifest parameter
 * through its curve, a general modifier linearly. Null when the track has no such slider.
 */
export function parameterValueAt(
  manifest: InstrumentManifest | undefined,
  parameter: string,
  fraction: number,
): number | null {
  const position = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  // An effect modifier (lowpass, eq-high, …) has the same range on every instrument.
  const definition = manifest?.parameters.find((entry) => entry.name === parameter) ?? effectParameter(parameter);
  if (definition !== undefined) {
    const value = readableValue(interp(definition.curve, definition.min, definition.max, position));
    return Math.min(definition.max, Math.max(definition.min, value));
  }
  // The gain fader: 0 dB at 75 % of the travel, three decimals.
  if (parameter === "gain") return positionToGain(position);
  const range = LINEAR_RANGES[parameter];
  if (range === undefined) return null;
  const [min, max] = range;
  return roundTo(min + (max - min) * position, 2);
}
