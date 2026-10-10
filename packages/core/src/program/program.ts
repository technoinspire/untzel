// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SourceRange } from "../pattern/event";
import type { EffectKind } from "../manifest/effects";
import type { ArpSpec, PatternSpec, Voicing } from "../pattern/pattern-spec";
import type { Key } from "../pitch/pitch";
import type { Rational } from "../time/rational";
import type { Curve, SignalValue } from "../pattern/signal";

// Everything here is readonly and structured-clone safe (no classes, no functions):
// it is what travels to the transport worker.

export interface Program {
  /**
   * `title "…"`, normalized (song-title.ts); null when the text has no title line or an
   * empty one (EMPTY_TITLE). It names the song and never changes the sound.
   */
  readonly title: string | null;
  /** bpm */
  readonly tempo: Rational;
  readonly key: Key;
  readonly swing: Rational;
  /** `loop <bars>`, 1..16; null when the text does not say it (see loopLengthOf). */
  readonly loopBars: number | null;
  /** Text order. */
  readonly tracks: readonly Track[];
  readonly sections: readonly Section[];
  readonly song: Song | null;
  readonly sourceHash: number;
  /** The light's seed: the text's hash without its `| mute` modifiers. */
  readonly lightSourceHash: number;
  /** The stage arrangement's seed: the hash of the production's header without `| mute`. */
  readonly stagePlanHash: number;
  /** Any "?" or rand signal: a program swap must then keep the draws. */
  readonly seedDependent: boolean;
}

export interface Track {
  readonly name: string;
  readonly instrument: string;
  readonly pattern: PatternSpec;
  readonly muted: boolean;
  readonly free: boolean;
  readonly transpose: number;
  readonly swing: Rational | null;
  readonly shift: number;
  /** The named sound written after the instrument; null is the default sound. */
  readonly preset: string | null;
  /** Velocity of "x" and of unaccented notes (0.8 when not written). */
  readonly velocity: number;
  readonly legato: boolean;
  readonly voicing: Voicing | null;
  readonly inversion: number;
  readonly arp: ArpSpec | null;
  /** Insert effects in chain order (the order of the text). */
  readonly effects: readonly EffectKind[];
  /** Fast signals and per-note envelopes, run by the DSP. At most 8. */
  readonly modulators: readonly ModulatorSpec[];
  /** General, effect and manifest parameters, preset and tone applied; one per DSP index. */
  readonly parameters: readonly ResolvedParameter[];
  /** The whole line. */
  readonly source: SourceRange;
}

export type ConstantValue = { readonly kind: "constant"; readonly value: number };

export interface ResolvedParameter {
  /** DSP parameter index: general 0..9, effects 16..31, instrument 32 + manifest order. */
  readonly index: number;
  readonly name: string;
  readonly value: ConstantValue | SignalValue;
  /** Written in the text (wins over tone). */
  readonly explicit: boolean;
}

export interface Section {
  readonly name: string;
  readonly tracks: readonly string[];
  readonly tempo: Rational | null;
  readonly gain: number;
  /** "section … | loop": what the loop mode plays (at most one section). */
  readonly isLoop: boolean;
}

/** A modulator the DSP runs. */
export type ModulatorSpec =
  | {
      readonly kind: "lfo";
      /** DSP parameter index. */
      readonly index: number;
      readonly shape: "sine" | "tri" | "saw" | "square";
      /** Below one bar. */
      readonly periodBars: Rational;
      readonly from: number;
      readonly to: number;
      readonly curve: Curve;
    }
  | {
      readonly kind: "envelope";
      readonly index: number;
      /** Time to reach `to` (99%) from `from` after every note. */
      readonly seconds: number;
      readonly from: number;
      readonly to: number;
      readonly curve: Curve;
    };

export interface SongPart {
  readonly section: string;
  readonly bars: number;
}

export interface Song {
  readonly parts: readonly SongPart[];
  readonly loop: boolean;
}

/** Fixed indices of the general parameters. Indices 10..15 are reserved. */
export const GeneralParameter = {
  gain: 0,
  pan: 1,
  reverbSend: 2,
  reverbSpace: 3,
  delaySend: 4,
  delayDivision: 5,
  duck: 6,
  glide: 7,
  legato: 8,
  /**
   * 1 sounds, 0 is silent. Never written in the text: the session's solo sets it. The DSP
   * applies it after gain and its modulators, so it silences a track whatever drives gain.
   */
  audible: 9,
} as const;

export type GeneralParameterName = keyof typeof GeneralParameter;

/** Index of the first instrument parameter; the rest follow manifest order. */
export const INSTRUMENT_PARAMETER_OFFSET = 32;

/** reverbSpace values. */
export const ReverbSpace = { small: 0, wide: 1, sea: 2, room: 3, plate: 4, hall: 5, dub: 6 } as const;
export type ReverbSpaceName = keyof typeof ReverbSpace;

/** delayDivision values. */
export const DelayDivision = { "1/8": 0, "3/16": 1, "1/4": 2 } as const;
export type DelayDivisionName = keyof typeof DelayDivision;
