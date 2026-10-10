// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One track as the tiles, the table and the detail show it: steps, sliders, sounds and
// effects, and what the track controls front needs of it.
import type { InstrumentGroup, InstrumentKind, PitchRange } from "@untzel/core";

/** How a tile reads. */
export type TrackPlayState = "on" | "off" | "queued" | "not-in-section";

export type StepKind = "rest" | "hit" | "accent" | "note" | "chord" | "hold";

export interface StepView {
  readonly kind: StepKind;
  /** Note or chord as written for pitched steps, for example "eb2" or "Cm7". */
  readonly label: string | null;
}

export interface SignalView {
  /** Range covered by the signal, as fractions of the slider. */
  readonly from: number;
  readonly to: number;
}

export interface ParameterView {
  readonly name: string;
  /** Human description, for example "0.70", "sine 8 bars · 300–2400" or "−6.0 dB". */
  readonly display: string;
  /** Thumb position, 0..1, already mapped through the manifest curve (gain: the fader law). */
  readonly fraction: number;
  readonly signal: SignalView | null;
  /** A parameter tone moves: written, it overrides tone; not written, it follows tone. */
  readonly toneRole: "overrides" | "follows" | null;
}

/** What the pattern of a track plays, as the language reads it (canPlay). */
export type PatternContentView = "hits" | "notes" | "chords";

/** A written parameter that overrides Tone. */
export interface ToneSetByView {
  readonly parameter: string;
  /** A signal drives it. */
  readonly isSignal: boolean;
}

export interface TrackView {
  readonly name: string;
  readonly instrument: string;
  readonly group: InstrumentGroup;
  readonly kind: InstrumentKind;
  /** 1-based source line of the track statement. */
  readonly line: number;
  readonly playState: TrackPlayState;
  /** Pulses once to show where to tap (the first block outside the loop section). */
  readonly isHinted: boolean;
  readonly isMuted: boolean;
  readonly isSoloed: boolean;
  /** Bar 1 of the pattern (the tile miniature). */
  readonly steps: readonly StepView[];
  readonly bars: number;
  /** Every bar of the pattern, in order; patternBars[0] is `steps`. */
  readonly patternBars: readonly (readonly StepView[])[];
  /** 0-based bar of the pattern sounding now; null when stopped. */
  readonly playingBar: number | null;
  /** Scale lock on (no `free`): notes outside the key move to it. */
  readonly isScaleLocked: boolean;
  /** MIDI notes the instrument plays (its manifest's `range`), for the note picker's keyboard. */
  readonly pitchRange: PitchRange;
  /** 0..1. */
  readonly tone: number;
  /** The manifest maps tone to some parameter; false shows no Tone control. */
  readonly hasTone: boolean;
  readonly sound: readonly ParameterView[];
  readonly mix: readonly ParameterView[];
  /** The named sound playing (the default one when the text writes none). */
  readonly preset: string;
  /** Every sound of the instrument, the default first. */
  readonly presets: readonly SoundView[];
  /** Insert effects in chain order, each with its sliders. */
  readonly effects: readonly EffectView[];
  /** The written parameters that override Tone; empty when Tone is in control. */
  readonly toneSetBy: readonly ToneSetByView[];
  /** The named starting patterns of the instrument. */
  readonly patterns: readonly string[];
  /** The pattern the text plays, when it is one of `patterns` in the music's key. */
  readonly currentPattern: string | null;
  /** What the track previews now and is not in the text yet ("Broken", "acid · squelch"). */
  readonly previewing: string | null;
  /** Change sound previewing on this track: the instrument and sound playing. */
  readonly previewingSound: { readonly instrument: string; readonly sound: string } | null;
  /** What the pattern plays, for Change sound. */
  readonly content: readonly PatternContentView[];
  /** Lowest and highest written note of the pattern; null without notes. */
  readonly noteSpan: PitchRange | null;
  /** Names of the instrument parameters the text writes. */
  readonly writtenParameters: readonly string[];
}

export interface EffectView {
  /** Effect kind, for example "lowpass" or "eq". */
  readonly effect: string;
  readonly parameters: readonly ParameterView[];
}

export interface SoundView {
  readonly name: string;
  readonly description: string;
}
