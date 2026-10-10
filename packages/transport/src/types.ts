// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { EventValue, Rational, SourceRange } from "@untzel/core";

export type PlaybackMode = "loop" | "song";

export interface ScheduledEvent {
  /** Absolute sample frame, integer. */
  readonly frame: number;
  readonly durationFrames: number;
  /** Which ProgramActivation trackIndex refers to. */
  readonly generation: number;
  /** Index in that activation's tracks. */
  readonly trackIndex: number;
  readonly value: EventValue;
  readonly velocity: number;
  /** Sounding-token highlight. */
  readonly source: SourceRange;
}

export interface ParameterPoint {
  readonly frame: number;
  readonly generation: number;
  readonly trackIndex: number;
  /** General 0..8, effects 16..31, instrument 32+. */
  readonly parameter: number;
  /** Parameter units. */
  readonly value: number;
  readonly rampFrames: number;
  /** The parameter's written value is a constant (a solo, an edit), not a sampled signal. */
  readonly isConstant: boolean;
}

export interface PlaybackPosition {
  /** Frame of the first bar boundary in the batch window. */
  readonly frame: number;
  /** Integer bar since play. */
  readonly bar: number;
  /** Bar the patterns read: `bar` minus the start of the pass of a written loop. */
  readonly patternBar: number;
  /** Loop mode only: 0-based bar inside the loop, and the loop length (1..16). */
  readonly loopBar: number | null;
  readonly loopBars: number | null;
  readonly mode: PlaybackMode;
  /** Song mode only. */
  readonly partIndex: number | null;
  readonly section: string | null;
  /** 0-based. */
  readonly barInPart: number | null;
  /** Song length; null in loop or with sections only. */
  readonly totalBars: number | null;
  /** Frames of one bar at the batch's tempo: the light's musical clock. */
  readonly framesPerBar: number;
}

export interface ScheduledBatch {
  readonly events: readonly ScheduledEvent[];
  readonly parameters: readonly ParameterPoint[];
  readonly position: PlaybackPosition;
}

export interface ActivatedTrack {
  /** Instance identity. */
  readonly name: string;
  /** Manifest name; the adapter maps it to instrumentId. */
  readonly instrument: string;
  /**
   * Value of every DSP parameter index at atFrame (signals sampled), indexed by
   * parameter index: 0..8 general, 9..15 reserved (0), 16..31 effects, 32+ instrument.
   */
  readonly parameters: readonly number[];
  /** Insert effects in chain order, as DSP kind numbers (`EFFECT_KINDS`). */
  readonly effects: readonly number[];
  readonly modulators: readonly ActivatedModulator[];
  /** `| mute` in the text. */
  readonly isMuted: boolean;
  /** Not muted and the gain the DSP applies is not held at 0 (isAudibleActivation). */
  readonly isAudible: boolean;
}

/**
 * A modulator the DSP runs, in DSP units:
 * shape 0 sine, 1 triangle, 2 saw, 3 square; curve 0 linear, 1 exponential. A `gain`
 * modulator arrives with `low` and `high` already times the section gain.
 */
export type ActivatedModulator =
  | {
      readonly kind: "lfo";
      readonly index: number;
      readonly shape: number;
      readonly curve: number;
      readonly periodFrames: number;
      /** Frame where the phase is 0: the start of the part (song) or of play (loop). */
      readonly originFrame: number;
      readonly low: number;
      readonly high: number;
    }
  | {
      readonly kind: "envelope";
      readonly index: number;
      readonly curve: number;
      readonly seconds: number;
      readonly low: number;
      readonly high: number;
    };

/** Every track of the program, including muted ones and ones outside the current section. */
export interface ProgramActivation {
  readonly generation: number;
  readonly atFrame: number;
  readonly tracks: readonly ActivatedTrack[];
  /** Program.lightSourceHash and Program.stagePlanHash: the light's seeds. */
  readonly lightSourceHash: number;
  readonly stagePlanHash: number;
}

export interface TempoChange {
  readonly bpm: number;
  readonly atFrame: number;
}

export interface TransportStats {
  /** Bar boundaries a late tick passed without their first beat. */
  readonly skippedBars: number;
  readonly resyncs: number;
}

/** A bar boundary of the music playing and its tempo: the grid a preview joins. */
export interface BeatGrid {
  readonly frame: number;
  /** bpm */
  readonly bpm: Rational;
}
