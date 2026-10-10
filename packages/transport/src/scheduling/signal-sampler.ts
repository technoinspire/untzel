// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  GeneralParameter,
  randomSignalDraw,
  signalAt,
  type Rational,
  type ResolvedParameter,
  type Track,
} from "@untzel/core";

/** A parameter driven by a signal is sampled every 1/16 bar and at every bar boundary. */
export const SIGNAL_POINTS_PER_BAR = 16;

/** Value of one parameter at a signal phase, in parameter units. */
export function parameterValueAt(
  parameter: ResolvedParameter,
  phaseBars: Rational,
  sourceHash: number,
  trackName: string,
): number {
  if (parameter.value.kind === "constant") return parameter.value.value;
  return signalAt(parameter.value, phaseBars, (periodIndex) =>
    randomSignalDraw(sourceHash, trackName, periodIndex),
  );
}

/**
 * Value of every DSP index at a phase, indexed by parameter index; the reserved indices
 * and any index the track does not resolve are 0. `gainFactor` is Section.gain while the
 * track plays inside a section, 1 otherwise.
 */
export function parameterTableAt(
  track: Track,
  phaseBars: Rational,
  sourceHash: number,
  gainFactor: number,
): number[] {
  const size = track.parameters.reduce((largest, parameter) => Math.max(largest, parameter.index + 1), 0);
  const table = new Array<number>(size).fill(0);
  for (const parameter of track.parameters) {
    const value = parameterValueAt(parameter, phaseBars, sourceHash, track.name);
    table[parameter.index] = applyGainFactor(parameter.index, value, gainFactor);
  }
  return table;
}

export function applyGainFactor(index: number, value: number, gainFactor: number): number {
  return index === GeneralParameter.gain ? value * gainFactor : value;
}

export function signalParameters(track: Track): readonly ResolvedParameter[] {
  return track.parameters.filter((parameter) => parameter.value.kind === "signal");
}

export function constantGain(track: Track): number | null {
  const gain = track.parameters.find((parameter) => parameter.index === GeneralParameter.gain);
  return gain?.value.kind === "constant" ? gain.value.value : null;
}
