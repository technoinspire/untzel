// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Curve } from "../pattern/signal";

// Insert effects of a track.
// The DSP mirrors this table in packages/dsp/src/params.rs
// (EFFECT_PARAMETERS) and packages/dsp/src/fx/inserts/chain.rs (kind order); the
// three change together.

export type EffectKind =
  | "lowpass"
  | "highpass"
  | "distort"
  | "crush"
  | "chorus"
  | "phaser"
  | "eq"
  | "comp"
  | "gate";

/** DSP kind number of each effect (`untzel_effect_order`). */
export const EFFECT_KINDS: readonly EffectKind[] = [
  "lowpass",
  "highpass",
  "distort",
  "crush",
  "chorus",
  "phaser",
  "eq",
  "comp",
  "gate",
];

export interface EffectParameter {
  /** Modifier name in the text. */
  readonly name: string;
  readonly effect: EffectKind;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly unit: string;
  readonly curve: Curve;
  /** Value written when the screen adds the effect; null for a secondary parameter. */
  readonly added: number | null;
}

/** DSP index of the first effect parameter; the table below follows in order. */
export const EFFECT_PARAMETER_OFFSET = 16;

export const EFFECT_PARAMETERS: readonly EffectParameter[] = [
  { name: "lowpass", effect: "lowpass", min: 20, max: 20000, default: 20000, unit: "Hz", curve: "exponential", added: 2000 },
  { name: "lowpass-q", effect: "lowpass", min: 0, max: 1, default: 0.2, unit: "", curve: "linear", added: null },
  { name: "highpass", effect: "highpass", min: 20, max: 20000, default: 20, unit: "Hz", curve: "exponential", added: 200 },
  { name: "highpass-q", effect: "highpass", min: 0, max: 1, default: 0.2, unit: "", curve: "linear", added: null },
  { name: "distort", effect: "distort", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.3 },
  { name: "crush", effect: "crush", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.3 },
  { name: "chorus", effect: "chorus", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.3 },
  { name: "chorus-rate", effect: "chorus", min: 0.05, max: 5, default: 0.6, unit: "Hz", curve: "exponential", added: null },
  { name: "phaser", effect: "phaser", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.3 },
  { name: "phaser-rate", effect: "phaser", min: 0.05, max: 5, default: 0.4, unit: "Hz", curve: "exponential", added: null },
  { name: "eq-low", effect: "eq", min: -18, max: 18, default: 0, unit: "dB", curve: "linear", added: null },
  { name: "eq-mid", effect: "eq", min: -18, max: 18, default: 0, unit: "dB", curve: "linear", added: null },
  { name: "eq-mid-freq", effect: "eq", min: 200, max: 8000, default: 1000, unit: "Hz", curve: "exponential", added: null },
  { name: "eq-high", effect: "eq", min: -18, max: 18, default: 0, unit: "dB", curve: "linear", added: 2 },
  { name: "comp", effect: "comp", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.4 },
  { name: "gate", effect: "gate", min: 0, max: 1, default: 0, unit: "", curve: "linear", added: 0.3 },
];

/** The effect parameter of a modifier name, or undefined. */
export function effectParameter(name: string): EffectParameter | undefined {
  return EFFECT_PARAMETERS.find((parameter) => parameter.name === name);
}

/** DSP index of an effect parameter. */
export function effectParameterIndex(name: string): number | null {
  const position = EFFECT_PARAMETERS.findIndex((parameter) => parameter.name === name);
  return position === -1 ? null : EFFECT_PARAMETER_OFFSET + position;
}
