// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The audition of the library: one track that loops its pattern on top of the music, or alone, for at most
// 16 bars. It never enters the text, the sections nor the light. With the music stopped
// it starts on the next render quantum at least 120 ms ahead, at the preview's tempo; with
// the music playing, on the next beat of the music's grid and tempo.

import { EFFECT_KINDS, GeneralParameter, barAt, compare, compilePattern, createOrigin, frameAt, min, rational, toNumber, type EventValue, type Program, type Rational, type TempoOrigin } from "@untzel/core";
import { activatedModulator } from "./activated-modulator";
import { floorBar, wholeBar } from "./bars";
import { compileProgram, type CompiledProgram, type PatternCompiler } from "./compiled-program";
import type { ClockPort } from "../ports";
import { scheduleSpan, type SpanContext, type SpanOutput } from "./schedule-span";
import { parameterTableAt } from "./signal-sampler";
import type { ActivatedTrack, BeatGrid, ParameterPoint, ScheduledEvent } from "../types";

/** Reserved generation and track index of the preview slot. */
export const PREVIEW_GENERATION = -1;
export const PREVIEW_TRACK = -1;
/** The longest audition, in bars. */
export const PREVIEW_MAX_BARS = 16;
/** The audition plays a little under the music. */
export const PREVIEW_GAIN = 0.8;

const LOOKAHEAD_SECONDS = 0.12;
/** A touched note plays this soon: past the worker → worklet hop, off the beat grid. */
const NOTE_SAFETY_SECONDS = 0.03;
/** Velocity of an auditioned note, as an unaccented step. */
const NOTE_VELOCITY = 0.8;
const RENDER_QUANTUM = 128;
const ZERO = rational(0n, 1n);
const LAST_BAR = wholeBar(PREVIEW_MAX_BARS);

export interface PreviewSink {
  /** Creates or recreates the preview slot with this sound at `atFrame`. */
  previewStarted(track: ActivatedTrack, atFrame: number): void;
  previewScheduled(events: readonly ScheduledEvent[], points: readonly ParameterPoint[]): void;
  /** Ended by stop, by another preview or by the 16-bar cap. */
  previewEnded(atFrame: number): void;
}

export interface PreviewDependencies {
  readonly clock: ClockPort;
  readonly sink: PreviewSink;
  readonly compile?: PatternCompiler;
}

interface Audition {
  readonly compiled: CompiledProgram;
  readonly origin: TempoOrigin;
  cursor: Rational;
}

export class PreviewTransport {
  readonly #clock: ClockPort;
  readonly #sink: PreviewSink;
  readonly #compile: PatternCompiler;
  readonly #lookaheadFrames: number;
  readonly #noteSafetyFrames: number;
  #audition: Audition | null = null;
  /** The preview slot sounds (a phrase or a note): the next start cuts it first. */
  #slotLive = false;

  constructor(dependencies: PreviewDependencies) {
    this.#clock = dependencies.clock;
    this.#sink = dependencies.sink;
    this.#compile = dependencies.compile ?? compilePattern;
    this.#lookaheadFrames = Math.round(LOOKAHEAD_SECONDS * dependencies.clock.sampleRate);
    this.#noteSafetyFrames = Math.round(NOTE_SAFETY_SECONDS * dependencies.clock.sampleRate);
  }

  get isActive(): boolean {
    return this.#audition !== null;
  }

  /**
   * Plays the first track of `program` (the text the session built for the audition),
   * replacing any audition. False when there is no track or no clock yet.
   */
  start(program: Program, grid: BeatGrid | null): boolean {
    const now = this.#clock.nowFrame();
    const track = program.tracks[0];
    if (now === null || track === undefined) return false;
    this.#cut(now);
    const sampleRate = this.#clock.sampleRate;
    const earliest = now + this.#lookaheadFrames;
    const startFrame = grid === null ? Math.ceil(earliest / RENDER_QUANTUM) * RENDER_QUANTUM : nextBeat(grid, earliest, sampleRate);
    const origin = createOrigin(ZERO, startFrame, grid?.bpm ?? program.tempo, sampleRate);
    const compiled = compileProgram({ ...program, tracks: [track], sections: [], song: null }, this.#compile);
    this.#sink.previewStarted(activatedPreview(program, track, origin, PREVIEW_GAIN), startFrame);
    this.#slotLive = true;
    this.#audition = { compiled, origin, cursor: ZERO };
    return true;
  }

  /**
   * Note audition: `midis` (one note or a chord) on the first track of `program`, with its
   * sound, effects and gain, now and off the beat grid, for `seconds`. It cuts whatever
   * the preview slot plays, so a track sounds one note at a time. False without a clock
   * or a track, or with no note.
   */
  note(program: Program, midis: readonly number[], seconds: number): boolean {
    const now = this.#clock.nowFrame();
    const track = program.tracks[0];
    if (now === null || track === undefined || midis.length === 0) return false;
    this.#cut(now);
    const sampleRate = this.#clock.sampleRate;
    const startFrame = Math.ceil((now + this.#noteSafetyFrames) / RENDER_QUANTUM) * RENDER_QUANTUM;
    const origin = createOrigin(ZERO, startFrame, program.tempo, sampleRate);
    this.#sink.previewStarted(activatedPreview(program, track, origin, 1), startFrame);
    this.#slotLive = true;
    const first = midis[0] ?? 0;
    const value: EventValue = midis.length === 1 ? { kind: "note", midi: first, writtenMidi: first } : { kind: "chord", midis: [...midis] };
    const event: ScheduledEvent = {
      frame: startFrame,
      durationFrames: Math.max(1, Math.round(seconds * sampleRate)),
      generation: PREVIEW_GENERATION,
      trackIndex: PREVIEW_TRACK,
      value,
      velocity: NOTE_VELOCITY,
      source: track.source,
    };
    this.#sink.previewScheduled([event], []);
    return true;
  }

  stop(): void {
    if (this.#audition === null && !this.#slotLive) return;
    this.#cut(this.#clock.nowFrame() ?? 0);
  }

  /** Ends the phrase and releases the slot (its voices fade out quickly). */
  #cut(atFrame: number): void {
    this.#audition = null;
    if (!this.#slotLive) return;
    this.#slotLive = false;
    this.#sink.previewEnded(atFrame);
  }

  /** Schedules up to 120 ms ahead; ends the audition at bar 16. */
  tick(): void {
    const audition = this.#audition;
    const now = this.#clock.nowFrame();
    if (audition === null || now === null) return;
    const until = min(barAt(audition.origin, now + this.#lookaheadFrames), LAST_BAR);
    const output: SpanOutput = { events: [], points: [] };
    const context = spanContext(audition);
    while (compare(audition.cursor, until) < 0) {
      const spanEnd = min(wholeBar(floorBar(audition.cursor) + 1), until);
      scheduleSpan(context, audition.cursor, spanEnd, output);
      audition.cursor = spanEnd;
    }
    if (output.events.length > 0 || output.points.length > 0) {
      this.#sink.previewScheduled(
        output.events.map((event) => ({ ...event, trackIndex: PREVIEW_TRACK })),
        output.points.map((point) => ({ ...point, trackIndex: PREVIEW_TRACK })),
      );
    }
    if (compare(audition.cursor, LAST_BAR) >= 0) this.#cut(frameAt(audition.origin, LAST_BAR));
  }
}

/** The preview slot's sound: the track's parameters, effects and modulators, its gain × `gainFactor`. */
function activatedPreview(program: Program, track: Program["tracks"][number], origin: TempoOrigin, gainFactor: number): ActivatedTrack {
  const barFrames = frameAt(origin, wholeBar(1)) - origin.frame;
  const parameters = [...parameterTableAt(track, ZERO, program.sourceHash, 1)];
  parameters[GeneralParameter.gain] = (parameters[GeneralParameter.gain] ?? 1) * gainFactor;
  return {
    name: track.name,
    instrument: track.instrument,
    parameters,
    effects: track.effects.map((effect) => EFFECT_KINDS.indexOf(effect)),
    modulators: track.modulators.map((spec) => activatedModulator(spec, barFrames, origin.frame, gainFactor)),
    isMuted: false,
    isAudible: true,
  };
}

function spanContext(audition: Audition): SpanContext {
  return {
    compiled: audition.compiled,
    origin: audition.origin,
    generation: PREVIEW_GENERATION,
    members: null,
    sectionGain: 1,
    phaseStart: ZERO,
    patternStart: ZERO,
    cycleOrigin: ZERO,
  };
}

/** The first beat of `grid` at or after `frame`. */
function nextBeat(grid: BeatGrid, frame: number, sampleRate: number): number {
  const beatFrames = (60 * sampleRate) / toNumber(grid.bpm);
  const beats = Math.max(0, Math.ceil((frame - grid.frame) / beatFrames));
  return Math.round(grid.frame + beats * beatFrames);
}
