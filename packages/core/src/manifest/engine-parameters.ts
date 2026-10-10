// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Curve } from "../pattern/signal";

// Canonical parameters of each synthesis engine. Parameters are public language surface: a manifest may
// narrow a range, never widen it, and keeps name, unit and curve.

export type EngineName = "va" | "fm" | "additive" | "string" | "modal" | "formant" | "percussion";

export const ENGINE_NAMES: readonly EngineName[] = ["va", "fm", "additive", "string", "modal", "formant", "percussion"];

export interface CanonicalContinuous {
  readonly kind: "continuous";
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly curve: Curve;
}

export interface CanonicalChoice {
  readonly kind: "choice";
  readonly choices: readonly string[];
}

export type CanonicalParameter = CanonicalContinuous | CanonicalChoice;

const lin = (min = 0, max = 1, unit = ""): CanonicalContinuous => ({ kind: "continuous", min, max, unit, curve: "linear" });
const time = (min: number, max: number): CanonicalContinuous => ({ kind: "continuous", min, max, unit: "s", curve: "exponential" });
const hz = (min: number, max: number): CanonicalContinuous => ({ kind: "continuous", min, max, unit: "Hz", curve: "exponential" });
const choice = (...choices: string[]): CanonicalChoice => ({ kind: "choice", choices });
const WAVES = ["saw", "square", "triangle", "sine"];

const ENVELOPE = {
  attack: time(0.001, 8),
  decay: time(0.01, 8),
  sustain: lin(),
  release: time(0.01, 8),
} as const;

export const ENGINE_PARAMETERS: Readonly<Record<EngineName, Readonly<Record<string, CanonicalParameter>>>> = {
  va: {
    cutoff: hz(20, 20000),
    resonance: lin(),
    brightness: lin(),
    ...ENVELOPE,
    detune: lin(),
    contour: lin(),
    width: lin(),
    wave: choice(...WAVES),
    accent: lin(),
    // Sound design: the second oscillator, the filter type and envelope,
    // drive before the filter and the stereo fan.
    wave2: choice(...WAVES),
    mix: lin(),
    sync: lin(),
    filter: choice("lp12", "lp24", "bp", "hp"),
    "filter-attack": time(0.001, 4),
    "filter-decay": time(0.01, 8),
    drive: lin(),
    spread: lin(),
    sub: lin(),
    noise: lin(),
    scoop: lin(),
    vibrato: lin(),
    ensemble: lin(),
    body: lin(),
    "low-cut": lin(),
    // Synthesis, or the recorded pack of the instrument where it has one.
    source: { kind: "choice", choices: ["synth", "samples"] },
    // Output trim of a named sound, so sounds of one instrument land at one level.
    level: lin(0.05, 8),
  },
  fm: { brightness: lin(), feedback: lin(), ...ENVELOPE, detune: lin(), tine: lin(), tremolo: lin(), level: lin(0.05, 8), source: { kind: "choice", choices: ["synth", "samples"] } },
  additive: { low: lin(), mid: lin(), high: lin(), percussion: lin(), attack: ENVELOPE.attack, release: ENVELOPE.release },
  string: {
    brightness: lin(),
    decay: time(0.1, 20),
    position: lin(),
    body: lin(),
    release: time(0.01, 4),
    detune: lin(),
    // Synthesis, or the recorded pack of the instrument where it has one.
    source: { kind: "choice", choices: ["synth", "samples"] },
    // Output trim of a named sound; on a recorded instrument it trims the recording.
    level: lin(0.05, 8),
  },
  modal: {
    tune: lin(),
    decay: time(0.01, 12),
    hardness: lin(),
    brightness: lin(),
    body: lin(),
    bend: lin(),
    release: time(0.05, 2),
    detune: lin(),
    noise: lin(),
    slap: lin(),
    tremolo: lin(),
    material: choice("wood", "metal", "hollow"),
    // Synthesis, or the recorded pack of the instrument where it has one.
    source: { kind: "choice", choices: ["synth", "samples"] },
    // Output trim of a named sound; on a recorded instrument it trims the recording.
    level: lin(0.05, 8),
  },
  formant: {
    vowel: lin(),
    breath: lin(),
    brightness: lin(),
    attack: ENVELOPE.attack,
    release: ENVELOPE.release,
    detune: lin(),
    // Synthesis, or the recorded pack of the instrument where it has one.
    source: { kind: "choice", choices: ["synth", "samples"] },
  },
  percussion: {
    decay: time(0.01, 8),
    tune: lin(),
    color: lin(),
    snap: lin(),
    spread: lin(),
    size: lin(),
    cutoff: hz(20, 20000),
    resonance: lin(),
    bend: lin(),
    length: lin(0, 30, "s"),
    tail: lin(),
    metal: lin(),
    // Synthesis, or the recorded hit of shaker and clap.
    source: { kind: "choice", choices: ["synth", "samples"] },
  },
};
