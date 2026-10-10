// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_PARAMETERS, EFFECT_PARAMETER_OFFSET } from "../manifest/effects";
import type { InstrumentManifest, ManifestParameter } from "../manifest/manifest";
import {
  DelayDivision,
  GeneralParameter,
  INSTRUMENT_PARAMETER_OFFSET,
  ReverbSpace,
  type ConstantValue,
  type DelayDivisionName,
  type GeneralParameterName,
  type ModulatorSpec,
  type ResolvedParameter,
  type ReverbSpaceName,
} from "../program/program";
import type { Rational } from "../time/rational";
import { interp, type Curve, type Signal, type SignalValue } from "../pattern/signal";

/**
 * A numeric modifier value as written in the text. For a signal, from..to is the
 * written range (for example 300..1400), in parameter units.
 */
export type WrittenValue =
  | { readonly kind: "constant"; readonly value: number }
  | {
      readonly kind: "signal";
      readonly signal: Signal;
      readonly from: number;
      readonly to: number;
    }
  /** A signal with a period below one bar: the DSP runs it. */
  | {
      readonly kind: "fast";
      readonly shape: "sine" | "tri" | "saw" | "square";
      readonly periodBars: Rational;
      readonly from: number;
      readonly to: number;
    }
  /** `env(s) a..b`: jumps to `a` at every note and reaches `b` in `s` seconds. */
  | { readonly kind: "envelope"; readonly seconds: number; readonly from: number; readonly to: number };
export type WrittenReverb =
  | { readonly kind: "send"; readonly value: WrittenValue }
  /** A named space; `send` is a numeric `reverb` written with it, else 0.3. */
  | { readonly kind: "space"; readonly space: ReverbSpaceName; readonly send: WrittenValue | null };
/**
 * The value-carrying modifiers of one track, already validated by language. Repeated
 * modifiers were collapsed (the last one wins). null means "not written".
 */
export interface WrittenParameters {
  readonly gain: WrittenValue | null;
  readonly pan: WrittenValue | null;
  readonly duck: WrittenValue | null;
  readonly tone: WrittenValue | null;
  readonly reverb: WrittenReverb | null;
  readonly delay: DelayDivisionName | null;
  /** glide seconds (mono instruments). */
  readonly glide: WrittenValue | null;
  readonly legato: boolean;
  /** Effect parameters written in the text, by modifier name (`lowpass`, `eq-high`). */
  readonly effects: readonly { readonly name: string; readonly value: WrittenValue }[];
  /** Manifest parameters written in the text, by manifest parameter name. */
  readonly instrument: readonly { readonly name: string; readonly value: WrittenValue }[];
  /** Values of the named sound (manifest parameter name → value; a choice is its index). */
  readonly preset: Readonly<Record<string, number>>;
}

/** Send level of "reverb <space>" and of "delay <division>". */
const NAMED_REVERB_SEND = 0.3;
const DELAY_SEND = 0.35;

function constant(value: number): ConstantValue {
  return { kind: "constant", value };
}

/**
 * A written value in the parameter domain: the signal sweeps from..to along the curve.
 * A DSP modulator (fast signal or envelope) starts at `from`; the modulator itself is in
 * `resolveTrackModulators`.
 */
function fromWritten(written: WrittenValue, curve: Curve): ConstantValue | SignalValue {
  if (written.kind === "constant") return constant(written.value);
  if (written.kind === "fast" || written.kind === "envelope") return constant(written.from);
  return {
    kind: "signal",
    signal: written.signal,
    low: 0,
    high: 1,
    from: written.from,
    to: written.to,
    curve,
  };
}

function general(
  name: GeneralParameterName,
  value: ConstantValue | SignalValue,
  explicit: boolean,
): ResolvedParameter {
  return { index: GeneralParameter[name], name, value, explicit };
}

function generalParameters(
  written: WrittenParameters,
  manifest: InstrumentManifest,
): ResolvedParameter[] {
  const { reverb, delay } = written;
  const reverbSend =
    reverb === null
      ? constant(0)
      : reverb.kind === "send"
        ? fromWritten(reverb.value, "linear")
        : reverb.send === null
          ? constant(NAMED_REVERB_SEND)
          : fromWritten(reverb.send, "linear");
  const reverbSpace = reverb?.kind === "space" ? ReverbSpace[reverb.space] : ReverbSpace.wide;
  const optional = (value: WrittenValue | null, fallback: number): ConstantValue | SignalValue =>
    value === null ? constant(fallback) : fromWritten(value, "linear");
  const gain = optional(written.gain, 1);
  return [
    general("gain", scaled(gain, toneLevelFactor(written, manifest)), written.gain !== null),
    general("pan", optional(written.pan, 0), written.pan !== null),
    general("reverbSend", reverbSend, reverb !== null),
    general("reverbSpace", constant(reverbSpace), reverb !== null),
    general("delaySend", constant(delay === null ? 0 : DELAY_SEND), delay !== null),
    general("delayDivision", constant(delay === null ? 0 : DelayDivision[delay]), delay !== null),
    general("duck", optional(written.duck, manifest.defaultDuck), written.duck !== null),
    general("glide", optional(written.glide, 0), written.glide !== null),
    general("legato", constant(written.legato ? 1 : 0), written.legato),
    general("audible", constant(1), false),
  ];
}

/**
 * The gain correction of a written constant tone: the manifest says how many dB the
 * level moves from tone 0 to tone 1, and the gain moves the opposite way from where the
 * sound sits without tone. 1 with no tone, a signal tone or no measured movement.
 */
export function toneLevelFactor(written: WrittenParameters, manifest: InstrumentManifest): number {
  const tone = written.tone;
  const mapping = manifest.tone[0];
  const parameter = manifest.parameters.find((entry) => entry.name === mapping?.parameter);
  if (tone?.kind !== "constant" || manifest.toneLevelDb === 0 || mapping === undefined || parameter === undefined) return 1;
  const resting = written.preset[parameter.name] ?? parameter.default;
  const restingTone = inverseInterp(parameter.curve, mapping.from, mapping.to, resting);
  return 10 ** ((-manifest.toneLevelDb * (tone.value - restingTone)) / 20);
}

/** Where `value` sits between `from` and `to` on the curve, clamped to 0..1. */
function inverseInterp(curve: Curve, from: number, to: number, value: number): number {
  const position = curve === "exponential" && from > 0 && to > 0 && value > 0 ? Math.log(value / from) / Math.log(to / from) : (value - from) / (to - from);
  return Number.isFinite(position) ? Math.min(1, Math.max(0, position)) : 0;
}

function scaled(value: ConstantValue | SignalValue, factor: number): ConstantValue | SignalValue {
  if (factor === 1) return value;
  return value.kind === "constant" ? constant(value.value * factor) : { ...value, from: value.from * factor, to: value.to * factor };
}

/** Every effect parameter at its written value or its default (DSP 16..31). */
function effectParameters(written: WrittenParameters): ResolvedParameter[] {
  return EFFECT_PARAMETERS.map((parameter, position): ResolvedParameter => {
    const entry = written.effects.find((effect) => effect.name === parameter.name);
    const value = entry === undefined ? constant(parameter.default) : fromWritten(entry.value, parameter.curve);
    return { index: EFFECT_PARAMETER_OFFSET + position, name: parameter.name, value, explicit: entry !== undefined };
  });
}

/** What tone does to one manifest parameter, or null when tone does not move it. */
function toneValue(
  tone: WrittenValue | null,
  parameter: ManifestParameter,
  manifest: InstrumentManifest,
): ConstantValue | SignalValue | null {
  const mapping = manifest.tone.find((entry) => entry.parameter === parameter.name);
  if (tone === null || mapping === undefined) return null;
  if (tone.kind === "constant") {
    return constant(interp(parameter.curve, mapping.from, mapping.to, tone.value));
  }
  if (tone.kind !== "signal") return null;
  return {
    kind: "signal",
    signal: tone.signal,
    low: tone.from,
    high: tone.to,
    from: mapping.from,
    to: mapping.to,
    curve: parameter.curve,
  };
}

/** DSP modulators of a track: every fast signal and envelope, in index order. */
export function resolveTrackModulators(
  written: WrittenParameters,
  manifest: InstrumentManifest,
): readonly ModulatorSpec[] {
  const entries: { index: number; value: WrittenValue; curve: Curve }[] = [];
  if (written.gain !== null) entries.push({ index: GeneralParameter.gain, value: written.gain, curve: "linear" });
  if (written.pan !== null) entries.push({ index: GeneralParameter.pan, value: written.pan, curve: "linear" });
  for (const effect of written.effects) {
    const position = EFFECT_PARAMETERS.findIndex((parameter) => parameter.name === effect.name);
    const parameter = EFFECT_PARAMETERS[position];
    if (parameter !== undefined) entries.push({ index: EFFECT_PARAMETER_OFFSET + position, value: effect.value, curve: parameter.curve });
  }
  manifest.parameters.forEach((parameter, order) => {
    const entry = written.instrument.find((candidate) => candidate.name === parameter.name);
    if (entry !== undefined) entries.push({ index: INSTRUMENT_PARAMETER_OFFSET + order, value: entry.value, curve: parameter.curve });
  });
  return entries.flatMap(({ index, value, curve }): ModulatorSpec[] => {
    if (value.kind === "fast") {
      return [{ kind: "lfo", index, shape: value.shape, periodBars: value.periodBars, from: value.from, to: value.to, curve }];
    }
    if (value.kind === "envelope") {
      return [{ kind: "envelope", index, seconds: value.seconds, from: value.from, to: value.to, curve }];
    }
    return [];
  });
}

/**
 * One ResolvedParameter per DSP index (general 0..8, effects 16..31, then 32 + manifest
 * order).
 * Resolution: manifest default → named sound → tone → explicit modifier.
 */
export function resolveTrackParameters(
  written: WrittenParameters,
  manifest: InstrumentManifest,
): readonly ResolvedParameter[] {
  const instrument = manifest.parameters.map((parameter, order): ResolvedParameter => {
    const index = INSTRUMENT_PARAMETER_OFFSET + order;
    const explicit = written.instrument.find((entry) => entry.name === parameter.name);
    if (explicit !== undefined) {
      return { index, name: parameter.name, value: fromWritten(explicit.value, parameter.curve), explicit: true };
    }
    const preset = written.preset[parameter.name];
    const fallback = constant(preset ?? parameter.default);
    // A choice parameter never follows tone.
    const tone = parameter.choices === null ? toneValue(written.tone, parameter, manifest) : null;
    return { index, name: parameter.name, value: tone ?? fallback, explicit: false };
  });
  return [...generalParameters(written, manifest), ...effectParameters(written), ...instrument];
}
