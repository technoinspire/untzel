// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type {
  ArpSpec,
  DelayDivisionName,
  EffectKind,
  InstrumentManifest,
  ManifestParameter,
  Rational,
  Voicing,
  WrittenParameters,
  WrittenReverb,
  WrittenValue,
} from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { removeFix, suggestionFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import { FLAGS, GENERAL_MODIFIERS, RULES, combineReverb, constantOf, isModulator, readDelay, readName, readReverb, rule } from "./modifier-values";
import type { ModifierSyntax } from "../highlight/outline";
import { ChordModifierReader } from "./read-chord-modifiers";
import { EffectModifierReader } from "./read-effect-modifiers";
import { exactNumber, readNumericValue } from "./read-values";
import { closest } from "../diagnostics/suggest";

// Track modifiers, by family: flags and the general mix and timing modifiers here, the
// insert effects in read-effect-modifiers.ts, voicing and the arpeggiator in
// read-chord-modifiers.ts, and last the parameters of the instrument's own manifest.

export interface TrackModifiers {
  readonly muted: boolean;
  readonly free: boolean;
  readonly transpose: number;
  readonly swing: Rational | null;
  readonly shift: number;
  readonly velocity: number;
  readonly legato: boolean;
  readonly voicing: Voicing | null;
  readonly inversion: number;
  readonly arp: ArpSpec | null;
  /** Insert effects in chain order. */
  readonly effects: readonly EffectKind[];
  readonly written: WrittenParameters;
  /** Some value uses a rand signal. */
  readonly usesRandom: boolean;
}

/** Most fast signals and envelopes one track can have (the DSP holds 8). */
export const MAX_MODULATORS = 8;
export const DEFAULT_VELOCITY = 0.8;

interface GeneralState {
  muted: boolean;
  free: boolean;
  transpose: number;
  swing: Rational | null;
  shift: number;
  velocity: number;
  legato: boolean;
  gain: WrittenValue | null;
  pan: WrittenValue | null;
  duck: WrittenValue | null;
  tone: WrittenValue | null;
  reverb: WrittenReverb | null;
  delay: DelayDivisionName | null;
  glide: WrittenValue | null;
}

/** A `reverb` with a room name and one with a number go together. */
function reverbKind(modifier: ModifierSyntax): "space" | "send" | null {
  if (modifier.name.text !== "reverb") return null;
  return modifier.value?.kind === "name" ? "space" : "send";
}

export function warnDuplicates(modifiers: readonly ModifierSyntax[], diagnostics: DiagnosticList): void {
  modifiers.forEach((modifier, index) => {
    const repeated = modifiers
      .slice(index + 1)
      .some((later) => later.name.text === modifier.name.text && reverbKind(later) === reverbKind(modifier));
    if (!repeated) return;
    diagnostics.warning("DUPLICATE_MODIFIER", messages.duplicateModifier(modifier.name.text), modifier, removeFix(modifier.removal, modifier.name.text));
  });
}

class TrackModifierReader {
  readonly #state: GeneralState = {
    muted: false,
    free: false,
    transpose: 0,
    swing: null,
    shift: 0,
    velocity: DEFAULT_VELOCITY,
    legato: false,
    gain: null,
    pan: null,
    duck: null,
    tone: null,
    reverb: null,
    delay: null,
    glide: null,
  };
  readonly #instrument = new Map<string, WrittenValue>();
  readonly #manifest: InstrumentManifest | null;
  readonly #instrumentName: string;
  readonly #diagnostics: DiagnosticList;
  readonly #chord: ChordModifierReader;
  readonly #effects: EffectModifierReader;
  #modulators = 0;

  constructor(manifest: InstrumentManifest | null, instrumentName: string, diagnostics: DiagnosticList) {
    this.#manifest = manifest;
    this.#instrumentName = instrumentName;
    this.#diagnostics = diagnostics;
    this.#chord = new ChordModifierReader(manifest, diagnostics);
    this.#effects = new EffectModifierReader(diagnostics, (modifier, value) => this.#counted(modifier, value));
  }

  read(modifier: ModifierSyntax, position: number): void {
    if (FLAGS.has(modifier.name.text)) {
      this.#readFlag(modifier);
      return;
    }
    if (this.#readGeneral(modifier) || this.#chord.read(modifier) || this.#effects.read(modifier, position)) return;
    this.#readInstrumentParameter(modifier);
  }

  #readFlag(modifier: ModifierSyntax): void {
    const name = modifier.name.text;
    const state = this.#state;
    if (modifier.value !== null) this.#diagnostics.error("OUT_OF_RANGE", messages.noValue(name), modifier.value);
    if (name === "mute") state.muted = true;
    else if (name === "free") state.free = true;
    else if (this.#requireMono(modifier)) state.legato = true;
  }

  /** Returns false when the modifier is not a general one. */
  #readGeneral(modifier: ModifierSyntax): boolean {
    const name = modifier.name.text;
    const state = this.#state;
    const diagnostics = this.#diagnostics;
    switch (name) {
      case "gain":
      case "pan":
      case "duck":
      case "tone":
        state[name] = this.#counted(modifier, readNumericValue(modifier, RULES[name], diagnostics));
        return true;
      case "transpose":
      case "shift":
        state[name] = constantOf(readNumericValue(modifier, RULES[name], diagnostics)) ?? 0;
        return true;
      case "swing": {
        const valid = readNumericValue(modifier, RULES.swing, diagnostics) !== null;
        state.swing = valid && modifier.value?.kind === "number" ? exactNumber(modifier.value.number) : null;
        return true;
      }
      case "velocity":
        state.velocity = constantOf(readNumericValue(modifier, RULES.velocity, diagnostics)) ?? DEFAULT_VELOCITY;
        return true;
      case "glide": {
        const value = readNumericValue(modifier, RULES.glide, diagnostics);
        if (value !== null && this.#requireMono(modifier)) state.glide = value;
        return true;
      }
      case "reverb":
        state.reverb = combineReverb(state.reverb, readReverb(modifier, diagnostics));
        return true;
      case "delay":
        state.delay = readDelay(modifier, diagnostics);
        return true;
      default:
        return false;
    }
  }

  /** Unknown instruments only get their general modifiers checked. */
  #readInstrumentParameter(modifier: ModifierSyntax): void {
    const manifest = this.#manifest;
    if (manifest === null) return;
    const name = modifier.name.text;
    const parameter = manifest.parameters.find((candidate) => candidate.name === name);
    if (parameter === undefined) {
      const candidates = [...GENERAL_MODIFIERS, ...manifest.parameters.map((candidate) => candidate.name)];
      const suggestion = closest(name, candidates);
      const message = messages.unknownModifier(this.#instrumentName, name, suggestion?.text ?? null);
      this.#diagnostics.error("UNKNOWN_MODIFIER", message, modifier.name, suggestionFix(modifier.name, suggestion));
      return;
    }
    const value = parameter.choices === null ? this.#readContinuous(modifier, parameter) : this.#readChoice(modifier, parameter);
    if (value === null) this.#instrument.delete(name);
    else this.#instrument.set(name, value);
  }

  #readContinuous(modifier: ModifierSyntax, parameter: ManifestParameter): WrittenValue | null {
    const parameterRule = rule(parameter.name, parameter.min, parameter.max, String(parameter.default), { allowsFast: true });
    return this.#counted(modifier, readNumericValue(modifier, parameterRule, this.#diagnostics));
  }

  #readChoice(modifier: ModifierSyntax, parameter: ManifestParameter): WrittenValue | null {
    const choices = parameter.choices ?? [];
    const chosen = readName(modifier, choices, this.#diagnostics);
    return chosen === null ? null : { kind: "constant", value: choices.indexOf(chosen) };
  }

  /** Counts DSP modulators; the ninth is TOO_MANY_MODULATORS. */
  #counted(modifier: ModifierSyntax, value: WrittenValue | null): WrittenValue | null {
    if (!isModulator(value)) return value;
    this.#modulators += 1;
    if (this.#modulators <= MAX_MODULATORS) return value;
    this.#diagnostics.error("TOO_MANY_MODULATORS", messages.tooManyModulators(MAX_MODULATORS), modifier);
    return null;
  }

  #requireMono(modifier: ModifierSyntax): boolean {
    const manifest = this.#manifest;
    if (manifest === null || manifest.allocation === "mono") return true;
    this.#diagnostics.warning("NO_EFFECT", messages.noEffectWithoutMono(modifier.name.text, manifest.name, manifest.kind === "chord"), modifier);
    return false;
  }

  result(preset: Readonly<Record<string, number>>): TrackModifiers {
    const { muted, free, transpose, swing, shift, velocity, legato } = this.#state;
    const { gain, pan, duck, tone, reverb, delay, glide } = this.#state;
    const effects = this.#effects.values;
    const instrument = this.#instrument;
    const written: WrittenParameters = {
      gain,
      pan,
      duck,
      tone,
      reverb,
      delay,
      glide,
      legato,
      effects: [...effects].map(([name, value]) => ({ name, value })),
      instrument: [...instrument].map(([name, value]) => ({ name, value })),
      preset,
    };
    const values = [gain, pan, duck, tone, ...instrument.values(), ...effects.values()];
    if (reverb?.kind === "send") values.push(reverb.value);
    if (reverb?.kind === "space" && reverb.send !== null) values.push(reverb.send);
    const usesRandom = values.some((value) => value?.kind === "signal" && value.signal.shape === "rand");
    return {
      muted,
      free,
      transpose,
      swing,
      shift,
      velocity,
      legato,
      voicing: this.#chord.voicing,
      inversion: this.#chord.inversion,
      arp: this.#chord.arp(),
      effects: this.#effects.order(),
      written,
      usesRandom,
    };
  }
}

/** Track modifiers, left to right; a repeated modifier warns and the last one wins. */
export function readTrackModifiers(
  modifiers: readonly ModifierSyntax[],
  manifest: InstrumentManifest | null,
  instrumentName: string,
  diagnostics: DiagnosticList,
  preset: Readonly<Record<string, number>> = {},
): TrackModifiers {
  warnDuplicates(modifiers, diagnostics);
  const reader = new TrackModifierReader(manifest, instrumentName, diagnostics);
  modifiers.forEach((modifier, position) => reader.read(modifier, position));
  return reader.result(preset);
}
