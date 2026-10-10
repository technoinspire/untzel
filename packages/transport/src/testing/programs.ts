// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Hand-built Programs and a pattern compiler for tests, so transport and session tests do
// not depend on the language or on core's compilePattern.
import {
  GeneralParameter,
  INSTRUMENT_PARAMETER_OFFSET,
  add,
  compare,
  floor,
  rational,
  type Event,
  type HitStep,
  type Pattern,
  type PatternContext,
  type PatternSpec,
  type Program,
  type Rational,
  type ResolvedParameter,
  type Section,
  type SignalValue,
  type Song,
  type TimeSpan,
  type Track,
} from "@untzel/core";
import type { PatternCompiler } from "../scheduling/compiled-program";

export interface FakeTrackOptions {
  readonly instrument?: string;
  /** One hits string per bar, for example ["x... x... x... x..."]; spaces are ignored. */
  readonly bars?: readonly string[];
  readonly muted?: boolean;
  /** Constant values by DSP index; the general ones default to gain and audible 1, the rest 0. */
  readonly constants?: Readonly<Record<number, number>>;
  readonly signals?: Readonly<Record<number, SignalValue>>;
  /** Number of instrument parameters (indices 32 + i); default 1. */
  readonly instrumentParameters?: number;
}

const GENERAL_NAMES = Object.keys(GeneralParameter);

export function fakeTrack(name: string, options: FakeTrackOptions = {}): Track {
  const bars = options.bars ?? ["x... x... x... x..."];
  const parameters: ResolvedParameter[] = [];
  const instrumentCount = options.instrumentParameters ?? 1;
  const indices = [
    ...GENERAL_NAMES.map((_, index) => index),
    ...Array.from({ length: instrumentCount }, (_, i) => INSTRUMENT_PARAMETER_OFFSET + i),
  ];
  for (const index of indices) {
    const signal = options.signals?.[index];
    const fallback = index === GeneralParameter.gain || index === GeneralParameter.audible ? 1 : 0;
    parameters.push({
      index,
      name: GENERAL_NAMES[index] ?? `p${index}`,
      value: signal ?? { kind: "constant", value: options.constants?.[index] ?? fallback },
      explicit: signal !== undefined || options.constants?.[index] !== undefined,
    });
  }
  return {
    name,
    instrument: options.instrument ?? name,
    pattern: hitsSpec(bars),
    muted: options.muted ?? false,
    free: false,
    transpose: 0,
    swing: null,
    shift: 0,
    preset: null,
    velocity: 0.8,
    legato: false,
    voicing: null,
    inversion: 0,
    arp: null,
    effects: [],
    modulators: [],
    parameters,
    source: { from: 0, to: 0 },
  };
}

export interface FakeProgramOptions {
  readonly tempo?: number;
  readonly sections?: readonly Section[];
  readonly song?: Song | null;
  readonly sourceHash?: number;
  readonly seedDependent?: boolean;
  readonly loopBars?: number | null;
}

export function fakeProgram(tracks: readonly Track[], options: FakeProgramOptions = {}): Program {
  return {
    title: null,
    tempo: rational(BigInt(options.tempo ?? 132), 1n),
    key: { tonic: 0, scale: "minor" },
    swing: rational(0n, 1n),
    loopBars: options.loopBars ?? null,
    tracks,
    sections: options.sections ?? [],
    song: options.song ?? null,
    sourceHash: options.sourceHash ?? 1,
    lightSourceHash: options.sourceHash ?? 1,
    stagePlanHash: 1,
    seedDependent: options.seedDependent ?? false,
  };
}

export function fakeSection(
  name: string,
  tracks: readonly string[],
  options: { readonly gain?: number; readonly tempo?: number; readonly isLoop?: boolean } = {},
): Section {
  return {
    name,
    tracks,
    tempo: options.tempo === undefined ? null : rational(BigInt(options.tempo), 1n),
    gain: options.gain ?? 1,
    isLoop: options.isLoop ?? false,
  };
}

/** A PatternSpec of one hits element per bar. */
export function hitsSpec(bars: readonly string[]): PatternSpec {
  let offset = 0;
  return {
    bars: bars.map((text) => {
      const steps = [...text.replaceAll(" ", "")].map(toHitStep);
      const source = { from: offset, to: offset + steps.length };
      offset = source.to + 1;
      return { elements: [{ kind: "hits", steps, accent: false, probability: null, repeat: 1, source }], source };
    }),
  };
}

/**
 * Compiles specs made by hitsSpec (one hits element per bar): each "x" or "X" is an event
 * of one step. The N-bar cycle is counted from `cycleOrigin` (bar 0 by default), like
 * compilePattern.
 */
export const fakeCompiler: PatternCompiler = (spec, context) => new HitsPattern(spec, context);

class HitsPattern implements Pattern {
  readonly #spec: PatternSpec;
  readonly #track: string;

  constructor(spec: PatternSpec, context: PatternContext) {
    this.#spec = spec;
    this.#track = context.trackName;
  }

  query(span: TimeSpan, cycleOrigin?: Rational): readonly Event[] {
    const events: Event[] = [];
    const cycle = this.#spec.bars.length;
    if (cycle === 0) return events;
    const firstBar = Number(floor(span.begin));
    const lastBar = Number(floor(span.end));
    const origin = cycleOrigin === undefined ? 0 : Number(floor(cycleOrigin));
    for (let bar = firstBar; bar <= lastBar; bar += 1) {
      const local = bar - origin;
      const element = this.#spec.bars[((local % cycle) + cycle) % cycle]?.elements[0];
      if (element?.kind !== "hits") continue;
      const steps = element.steps.length;
      element.steps.forEach((step, index) => {
        if (step !== "hit" && step !== "accent") return;
        const begin = add(rational(BigInt(bar), 1n), rational(BigInt(index), BigInt(steps)));
        if (compare(begin, span.begin) < 0 || compare(begin, span.end) >= 0) return;
        events.push({
          track: this.#track,
          begin,
          duration: rational(1n, BigInt(steps)),
          value: { kind: "hit", accent: step === "accent" },
          velocity: step === "accent" ? 1 : 0.8,
          source: { from: element.source.from + index, to: element.source.from + index + 1 },
        });
      });
    }
    return events;
  }
}

function toHitStep(character: string): HitStep {
  if (character === "x") return "hit";
  if (character === "X") return "accent";
  if (character === "~") return "sustain";
  return "rest";
}
