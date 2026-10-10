// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The value a DSP modulator (a fast LFO or a per-note envelope) gives a parameter at a frame, for the light. A port of
// packages/dsp/src/modulation.rs (Modulator::position and ::value, with math::sine and
// engines::fast_exp2), in f32 like the engine. The Rust engine is the reference: both
// sides check packages/dsp/vectors/modulators.txt. Pure.

const f = Math.fround;
export const ModulatorShape = { sine: 0, triangle: 1, saw: 2, square: 3 } as const;
export const ModulatorCurve = { linear: 0, exponential: 1 } as const;

/** What the formula reads; ActivatedModulator satisfies it without core importing transport. */
export interface ModulatorRange {
  readonly curve: number;
  readonly low: number;
  readonly high: number;
}
export type ModulatorInput =
  | (ModulatorRange & { readonly kind: "lfo"; readonly shape: number; readonly periodFrames: number; readonly originFrame: number })
  | (ModulatorRange & { readonly kind: "envelope"; readonly seconds: number });

/** math::sine: the parabolic sine of a phase in [0, 1). */
function dspSine(phase: number): number {
  const x = f(phase - 0.5);
  const y = f(f(8 * x) - f(f(16 * x) * Math.abs(x)));
  return -f(f(f(0.225) * f(f(y * Math.abs(y)) - y)) + y);
}

/** engines::fast_exp2. */
function fastExp2(value: number): number {
  const x = f(Math.min(30, Math.max(-30, value)));
  const floor = Math.floor(x);
  const fraction = f(x - floor);
  const p = f(1 + f(fraction * f(f(0.6960656) + f(fraction * f(f(0.22449434) + f(fraction * f(0.07944024)))))));
  return f(p * 2 ** floor);
}

/** 0..1 along the range of an LFO at `frame`: the phase comes from the frame, never from history. */
export function lfoPosition(shape: number, periodFrames: number, originFrame: number, frame: number): number {
  const cycles = (frame - originFrame) / periodFrames;
  const phase = f(cycles - Math.floor(cycles));
  return positionOfPhase(shape, phase);
}

/** The LFO's position at a phase 0..1 of its cycle. */
export function positionOfPhase(shape: number, phase: number): number {
  if (shape === ModulatorShape.sine) return f(0.5 + f(0.5 * dspSine(f(f(phase + 0.75) % 1))));
  if (shape === ModulatorShape.triangle) return phase < 0.5 ? f(2 * phase) : f(2 - f(2 * phase));
  if (shape === ModulatorShape.saw) return phase;
  return phase < 0.5 ? 0 : 1;
}

/** 0..1 of an envelope `elapsedSeconds` after its note: 99 % of the way at `seconds`. */
export function envelopePosition(seconds: number, elapsedSeconds: number): number {
  return f(1 - f(Math.exp(f(f(-4.60517 * Math.max(0, f(elapsedSeconds))) / Math.max(f(seconds), 0.001)))));
}

/** The parameter's value at `position` along low..high on the modulator's curve. */
export function valueAt(modulator: ModulatorRange, position: number): number {
  if (modulator.curve === ModulatorCurve.exponential) {
    const octaves = f(Math.log2(f(f(modulator.high) / f(modulator.low))));
    return f(f(modulator.low) * fastExp2(f(octaves * position)));
  }
  return f(f(modulator.low) + f(f(f(modulator.high) - f(modulator.low)) * position));
}

/** The value the DSP drives at `frame`; `noteFrame` is the note's start (envelope only, −1 before any). */
export function modulatorValueAt(modulator: ModulatorInput, frame: number, noteFrame: number, sampleRate: number): number {
  if (modulator.kind === "lfo") return valueAt(modulator, lfoPosition(modulator.shape, modulator.periodFrames, modulator.originFrame, frame));
  if (noteFrame < 0) return valueAt(modulator, 0);
  return valueAt(modulator, envelopePosition(modulator.seconds, (frame - noteFrame) / sampleRate));
}

/** False for what the DSP refuses (set_lfo and set_envelope return false): the light ignores it too. */
export function isAcceptedModulator(modulator: ModulatorInput): boolean {
  if (!Number.isFinite(modulator.low) || !Number.isFinite(modulator.high) || modulator.curve > ModulatorCurve.exponential) return false;
  if (modulator.curve === ModulatorCurve.exponential && (modulator.low <= 0 || modulator.high <= 0)) return false;
  if (modulator.kind === "lfo") return modulator.shape <= ModulatorShape.square && Number.isFinite(modulator.periodFrames) && modulator.periodFrames > 0;
  return Number.isFinite(modulator.seconds) && modulator.seconds > 0;
}
