// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { GeneralParameter, toNumber, type ModulatorSpec } from "@untzel/core";
import type { ActivatedModulator } from "../types";

const LFO_SHAPES = { sine: 0, tri: 1, saw: 2, square: 3 } as const;
const CURVES = { linear: 0, exponential: 1 } as const;


/** A modulator in DSP units at the current tempo (`barFrames` frames per bar). */
export function activatedModulator(
  spec: ModulatorSpec,
  barFrames: number,
  originFrame: number,
  gainFactor: number,
): ActivatedModulator {
  const factor = spec.index === GeneralParameter.gain ? gainFactor : 1;
  const low = spec.from * factor;
  const high = spec.to * factor;
  const curve = CURVES[spec.curve];
  if (spec.kind === "envelope") {
    return { kind: "envelope", index: spec.index, curve, seconds: spec.seconds, low, high };
  }
  return {
    kind: "lfo",
    index: spec.index,
    shape: LFO_SHAPES[spec.shape],
    curve,
    periodFrames: toNumber(spec.periodBars) * barFrames,
    originFrame,
    low,
    high,
  };
}
