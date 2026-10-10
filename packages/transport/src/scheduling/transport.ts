// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Over 300 lines: the realtime transport, one class whose play, tick and bar steps share the active program and position; it is split only with its own timing measurement.

import {
  barAt,
  EFFECT_KINDS,
  GeneralParameter,
  compare,
  compilePattern,
  frameAt,
  locate,
  loopLengthOf,
  loopSectionOf,
  min,
  originAtBar,
  rational,
  retempo,
  toNumber,
  type PartLocation,
  type Program,
  type Rational,
  type TempoOrigin,
  type ModulatorSpec,
  type Section,
  type Track,
} from "@untzel/core";
import { activatedModulator } from "./activated-modulator";
import { isAudibleActivation } from "./audibility";
import type { PlayRange, PlayRangeChange } from "../play-range/play-range";
import { lastBarOf, rangeStartBar, rulerBarPlayed } from "../play-range/play-range-ruler";
import { playRangeStep } from "../play-range/play-range-step";
import { boundaryOf, ceilStep, floorBar, wholeBar } from "./bars";
import { changedParameters, classifyChange } from "./classify-change";
import { compileProgram, type CompiledProgram, type PatternCompiler } from "./compiled-program";
import type { ClockPort, EventSink } from "../ports";
import { scheduleSpan, type SpanContext, type SpanOutput } from "./schedule-span";
import { applyGainFactor, constantGain, parameterTableAt } from "./signal-sampler";
import type {
  BeatGrid,
  ParameterPoint,
  PlaybackMode,
  PlaybackPosition,
  ProgramActivation,
  TransportStats,
} from "../types";

export interface TransportDependencies {
  readonly clock: ClockPort;
  readonly sink: EventSink;
  /** Defaults to compilePattern from @untzel/core. */
  readonly compile?: PatternCompiler;
}

export type TransportPlayResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "NO_PROGRAM" | "SONG_UNAVAILABLE" | "INVALID_START" };
export interface PlayOptions {
  /**
   * Bar where playback begins, default 0. Everything from it on is what a play from bar 0
   * would schedule from that bar, every frame shifted by one constant (the export uses it).
   */
  readonly startBar?: number;
}

/** Schedule this far ahead of the clock. */
export const LOOKAHEAD_SECONDS = 0.12;
/** The clock is considered suspended when its last report is older than this. */
export const STALE_AFTER_MS = 250;
/**
 * The lookahead while the page is hidden (minimized window, another tab): the browser may
 * run the worker's timer once a second or less, and a 120 ms lookahead then runs dry and
 * the music cuts. Two seconds ahead costs nothing while nobody edits.
 */
export const BACKGROUND_LOOKAHEAD_SECONDS = 2;
/** Ramp of an immediate parameter change. */
export const PARAMETER_RAMP_SECONDS = 0.02;
/** Mode changes enter on multiples of this many bars since play. */
export const PHRASE_BARS = 4;
/** The start frame is aligned up to the render quantum. */
const RENDER_QUANTUM = 128;
/** Immediate parameter points and resync land at least this far after now. */
const SAFETY_FRAMES = 128;
/**
 * A late tick resumes on the next sixteenth of the bar, the pattern grid: the
 * longest silence is about one step (113 ms at 132 BPM), not the rest of the bar.
 */
export const RESYNC_STEPS_PER_BAR = 16;

const ZERO = rational(0n, 1n);

type PendingProgram = { readonly program: Program; readonly kind: "structural" | "reseed" };

/** State that exists only while playing. */
interface Playback {
  origin: TempoOrigin;
  readonly startFrame: number;
  /** Everything before this frame was delivered. */
  scheduledUntil: number;
  /** bar(scheduledUntil), exact. */
  cursor: Rational;
  /** Last bar boundary whose actions ran. */
  processedBoundary: number;
  mode: PlaybackMode;
  /** Bar where arrangement bar 0 sits; song mode only. */
  songStartBar: number;
  /** First bar of the current pass of a written `loop <bars>`; null otherwise. */
  loopStart: number | null;
  pendingMode: PlaybackMode | null;
  /** Loop mode: a play range owns loopStart until stop or a mode change (#advanceLoop keeps off). */
  rangeOwnsPass: boolean;
  /** The range of the sounding mode changed since the last boundary: what it was, and Play from here. */
  rangeChange: { readonly previous: PlayRange | null; locate: boolean } | null;
  resyncNeeded: boolean;
  lastPosition: PlaybackPosition | null;
}

interface TickOutput extends SpanOutput {
  firstBoundary: number | null;
  endedAt: number | null;
}

/**
 * Schedules the active Program 120 ms ahead in exact rational time. Creates no timer:
 * the worker calls tick() every 25 ms. Never sees text.
 */
export class Transport {
  readonly #clock: ClockPort;
  readonly #sink: EventSink;
  readonly #compile: PatternCompiler;
  #lookaheadFrames: number;
  readonly #foregroundFrames: number;
  readonly #backgroundFrames: number;
  readonly #rampFrames: number;

  #active: CompiledProgram | null = null;
  /** The program whose constant parameters were last sent: active, or a reseed pending. */
  #parameterBaseline: Program | null = null;
  #pending: PendingProgram | null = null;
  #generation = 0;
  /** startBar null: the start of the mode's play range, or bar 0. */
  #startRequest: { mode: PlaybackMode; readonly startBar: number | null } | null = null;
  /** The last play range of each mode; kept across stop, applied on a bar boundary. */
  readonly #ranges: Record<PlaybackMode, PlayRange | null> = { loop: null, song: null };
  #playback: Playback | null = null;
  #skippedBars = 0;
  #resyncs = 0;

  constructor(dependencies: TransportDependencies) {
    this.#clock = dependencies.clock;
    this.#sink = dependencies.sink;
    this.#compile = dependencies.compile ?? compilePattern;
    this.#foregroundFrames = Math.round(LOOKAHEAD_SECONDS * dependencies.clock.sampleRate);
    this.#backgroundFrames = Math.round(BACKGROUND_LOOKAHEAD_SECONDS * dependencies.clock.sampleRate);
    this.#lookaheadFrames = this.#foregroundFrames;
    this.#rampFrames = Math.round(PARAMETER_RAMP_SECONDS * dependencies.clock.sampleRate);
  }

  /** The page went to the background or came back: how far ahead the next ticks schedule. */
  setBackground(isHidden: boolean): void {
    this.#lookaheadFrames = isHidden ? this.#backgroundFrames : this.#foregroundFrames;
  }
  /** Stopped: replaces the program at once. Playing: classifyChange decides when. */
  setProgram(next: Program): void {
    const playback = this.#playback;
    const active = this.#active;
    if (playback === null || active === null) {
      this.#activate(next);
      this.#pending = null;
      return;
    }
    if (classifyChange(active.program, next) === "structural") {
      this.#pending = { program: next, kind: "structural" };
      return;
    }
    this.#sendParameterChanges(playback, next);
    if (next.sourceHash !== active.program.sourceHash && next.seedDependent) {
      // Draws of the current bar stay the old text's; the new ones start at the boundary.
      this.#pending = { program: next, kind: "reseed" };
      this.#parameterBaseline = next;
      return;
    }
    this.#pending = null;
    this.#activate(next);
  }

  /** No argument: "song" when the program has sections, "loop" otherwise. Playing: setMode. */
  play(mode?: PlaybackMode, options?: PlayOptions): TransportPlayResult {
    const active = this.#active;
    if (active === null) return { ok: false, code: "NO_PROGRAM" };
    const resolved = mode ?? (active.program.sections.length > 0 ? "song" : "loop");
    if (this.#playback !== null || this.#startRequest !== null) return this.setMode(resolved);
    if (resolved === "song" && active.arrangement === null) {
      return { ok: false, code: "SONG_UNAVAILABLE" };
    }
    const startBar = options?.startBar ?? null;
    const songBars = resolved === "song" ? (active.arrangement?.totalBars ?? 0) : Infinity;
    if (startBar !== null && (!Number.isInteger(startBar) || startBar < 0 || startBar >= songBars)) {
      return { ok: false, code: "INVALID_START" };
    }
    this.#startRequest = { mode: resolved, startBar };
    const now = this.#clock.nowFrame();
    if (now !== null) this.#begin(now);
    return { ok: true };
  }

  /** Playing: takes effect at the next unscheduled 4-bar phrase boundary. */
  setMode(mode: PlaybackMode): TransportPlayResult {
    const active = this.#active;
    if (active === null) return { ok: false, code: "NO_PROGRAM" };
    if (mode === "song" && active.arrangement === null) {
      return { ok: false, code: "SONG_UNAVAILABLE" };
    }
    if (this.#startRequest !== null) this.#startRequest.mode = mode;
    const playback = this.#playback;
    if (playback !== null) playback.pendingMode = mode === playback.mode ? null : mode;
    return { ok: true };
  }

  stop(): void {
    this.#startRequest = null;
    const playback = this.#playback;
    if (playback === null) return;
    this.#finishPlayback();
    this.#sink.stopped(this.#clock.nowFrame() ?? playback.scheduledUntil);
  }

  /**
   * The play range of one mode. Stopped: where the next play starts. Playing
   * that mode: it enters on the next unscheduled bar boundary, never stopping the music;
   * another mode's range waits for that mode to enter.
   */
  setPlayRange(change: PlayRangeChange): void {
    const previous = this.#ranges[change.mode];
    this.#ranges[change.mode] = change.range;
    const playback = this.#playback;
    if (playback === null || playback.mode !== change.mode) return;
    const pending = playback.rangeChange;
    playback.rangeChange = { previous: pending?.previous ?? previous, locate: (pending?.locate ?? false) || change.locate };
  }

  /** Schedules [scheduledUntil, now + 120 ms) and delivers one batch to the sink. */
  tick(): void {
    const now = this.#clock.nowFrame();
    if (now === null) return;
    if (this.#clock.staleness() > STALE_AFTER_MS) {
      if (this.#playback !== null) this.#playback.resyncNeeded = true;
      return;
    }
    if (this.#startRequest !== null) this.#begin(now);
    const playback = this.#playback;
    if (playback === null) return;
    if ((playback.resyncNeeded || playback.scheduledUntil < now) && !this.#resync(playback, now)) return;
    this.scheduleUntil(now + this.#lookaheadFrames);
  }

  /** Everything before this frame was delivered; null when stopped or with a play pending. */
  scheduledUntil(): number | null {
    return this.#playback?.scheduledUntil ?? null;
  }

  /**
   * Schedules [scheduledUntil, frame) and delivers one batch, without the stale-clock and
   * late-tick checks of tick(); nothing at or below what is already scheduled.
   */
  scheduleUntil(frame: number): void {
    const playback = this.#playback;
    if (playback === null || frame <= playback.scheduledUntil) return;
    this.#scheduleWindow(playback, frame);
  }

  /** While playing: a bar boundary already scheduled and the tempo there, for the preview. */
  beatGrid(): BeatGrid | null {
    const playback = this.#playback;
    if (playback === null) return null;
    return { frame: frameAt(playback.origin, wholeBar(floorBar(playback.cursor))), bpm: playback.origin.tempo };
  }

  stats(): TransportStats {
    return { skippedBars: this.#skippedBars, resyncs: this.#resyncs };
  }

  #activate(program: Program): void {
    this.#active = compileProgram(program, this.#compile);
    this.#parameterBaseline = program;
  }

  // Over 40 lines: realtime scheduling; the start's steps run in one call, in this order, and are not restructured without a timing measurement.
  #begin(now: number): void {
    const request = this.#startRequest;
    const active = this.#active;
    this.#startRequest = null;
    if (request === null || active === null) return;
    const { mode } = request;
    const fromRange = request.startBar === null ? rangeStartBar(this.#ranges[mode], active.program, active.arrangement, mode) : null;
    const startBar = request.startBar ?? fromRange ?? 0;
    const startFrame =
      Math.ceil((now + this.#lookaheadFrames) / RENDER_QUANTUM) * RENDER_QUANTUM;
    const songMode = mode === "song" && active.arrangement !== null;
    // Virtual origin: the one a play from bar 0 at frame 0 would have at startBar, moved
    // so that startBar lands on startFrame. Every later frame then differs from that play
    // by one constant; an origin created at startBar would land 1 frame off after rounding.
    const atBar = originAtBar(
      active.program,
      active.arrangement,
      songMode ? "song" : "loop",
      startBar,
      this.#clock.sampleRate,
    );
    const cursor = wholeBar(startBar);
    const loopLength = loopLengthOf(active.program);
    const origin: TempoOrigin = {
      ...atBar,
      frame: atBar.frame + startFrame - frameAt(atBar, cursor),
    };
    const playback: Playback = {
      origin,
      startFrame,
      scheduledUntil: startFrame,
      cursor,
      processedBoundary: startBar,
      mode: songMode ? "song" : "loop",
      songStartBar: 0,
      // Same pass a play from bar 0 would be in at startBar.
      // A loop range starts its own pass: patterns read the range's first bar.
      loopStart:
        !songMode && fromRange !== null ? 0 : !songMode && loopLength.declared ? startBar - (startBar % loopLength.bars) : null,
      pendingMode: null,
      rangeOwnsPass: !songMode && fromRange !== null,
      rangeChange: null,
      resyncNeeded: false,
      lastPosition: null,
    };
    this.#playback = playback;
    this.#generation += 1;
    this.#sink.tempoChanged({ bpm: toNumber(playback.origin.tempo), atFrame: startFrame });
    this.#sink.programChanged(this.#activation(playback, startBar));
  }

  /**
   * "The sound never stops": instead of playing late, resume on the next
   * sixteenth in time. Every bar boundary passed meanwhile still runs, in order and
   * without its notes, so the tempo, the loop pass, the part and the play range are where
   * a play without the late tick would have them; their gain points land at the resume.
   * Notes already sounding finish on their own. Returns false when the song ended there.
   */
  #resync(playback: Playback, now: number): boolean {
    const resumeFrame = now + SAFETY_FRAMES;
    const passed: TickOutput = { events: [], points: [], firstBoundary: null, endedAt: null };
    this.#resyncs += 1;
    playback.resyncNeeded = false;
    for (let bar = nextBoundary(playback); frameAt(playback.origin, wholeBar(bar)) <= resumeFrame; bar = nextBoundary(playback)) {
      playback.cursor = wholeBar(bar);
      playback.processedBoundary = bar;
      this.#skippedBars += 1;
      if (!this.#enterBar(playback, bar, passed)) {
        this.#finishPlayback();
        this.#sink.ended(passed.endedAt ?? resumeFrame);
        return false;
      }
    }
    const step = ceilStep(barAt(playback.origin, resumeFrame), RESYNC_STEPS_PER_BAR);
    playback.cursor = compare(step, playback.cursor) > 0 ? step : playback.cursor;
    playback.scheduledUntil = frameAt(playback.origin, playback.cursor);
    if (passed.points.length > 0) {
      const parameters = passed.points.map((point) => ({ ...point, frame: Math.max(point.frame, resumeFrame) }));
      this.#sink.deliver({ events: [], parameters, position: this.#positionAt(playback, floorBar(playback.cursor)) });
    }
    return true;
  }

  /** Cuts [scheduledUntil, horizon) at bar boundaries and schedules each piece. */
  #scheduleWindow(playback: Playback, horizon: number): void {
    const output: TickOutput = { events: [], points: [], firstBoundary: null, endedAt: null };
    const windowStartBar = floorBar(playback.cursor);
    for (;;) {
      const endBar = barAt(playback.origin, horizon);
      if (compare(playback.cursor, endBar) >= 0) break;
      const boundary = boundaryOf(playback.cursor);
      if (boundary !== null && boundary > playback.processedBoundary) {
        playback.processedBoundary = boundary;
        output.firstBoundary ??= boundary;
        if (!this.#enterBar(playback, boundary, output)) break;
        continue; // the origin may have changed: recompute endBar
      }
      const spanEnd = min(wholeBar(floorBar(playback.cursor) + 1), endBar);
      scheduleSpan(this.#spanContext(playback), playback.cursor, spanEnd, output);
      playback.cursor = spanEnd;
    }
    playback.scheduledUntil = horizon;
    const position = this.#positionAt(playback, output.firstBoundary ?? windowStartBar);
    playback.lastPosition = position;
    output.events.sort((a, b) => a.frame - b.frame);
    output.points.sort((a, b) => a.frame - b.frame);
    this.#sink.deliver({ events: output.events, parameters: output.points, position });
    if (output.endedAt !== null) {
      this.#finishPlayback();
      this.#sink.ended(output.endedAt);
    }
  }

  /**
   * Boundary actions, in order: pending program, mode, loop pass, play range, song end,
   * tempo, activation or part-start gain points. Returns false when the song ended here.
   */
  // Over 40 lines: realtime scheduling; the boundary actions run in the order listed above, in one call per bar.
  #enterBar(playback: Playback, bar: number, output: TickOutput): boolean {
    const current = rulerBarPlayed(bar, playback, this.#requireActive().program, this.#active?.arrangement ?? null);
    const activated = this.#applyPendingProgram();
    const active = this.#requireActive();
    let modeChanged = false;
    const atPhrase = bar % PHRASE_BARS === 0;
    if (atPhrase && playback.pendingMode !== null) {
      modeChanged = playback.pendingMode !== playback.mode;
      playback.mode = playback.pendingMode;
      playback.pendingMode = null;
      if (playback.mode === "song") playback.songStartBar = bar;
    }
    if (playback.mode === "song" && active.arrangement === null) {
      playback.mode = "loop";
      modeChanged = true;
    }
    if (modeChanged) {
      playback.rangeOwnsPass = false;
      playback.rangeChange = null;
    }
    this.#advanceLoop(playback, bar, modeChanged);
    this.#applyPlayRange(playback, bar, current, modeChanged);
    const location = this.#locationAt(playback, bar);
    if (playback.mode === "song" && location === null) {
      output.endedAt = frameAt(playback.origin, wholeBar(bar));
      return false;
    }
    const tempo = this.#tempoAt(playback, bar);
    let retempoed = false;
    if (compare(tempo, playback.origin.tempo) !== 0) {
      playback.origin = retempo(playback.origin, wholeBar(bar), tempo, this.#clock.sampleRate);
      this.#sink.tempoChanged({ bpm: toNumber(tempo), atFrame: playback.origin.frame });
      retempoed = true;
    }
    const partStart = location?.barInPart === 0;
    if (activated) {
      this.#sink.programChanged(this.#activation(playback, bar));
    } else {
      if (modeChanged || partStart) output.points.push(...this.#gainPoints(playback, bar));
      // LFO periods follow the tempo and their phase restarts with the part: the same
      // generation, sent again, only moves the modulators.
      if ((modeChanged || partStart || retempoed) && hasModulators(active.program)) {
        this.#sink.programChanged(this.#activation(playback, bar));
      }
    }
    return true;
  }

  /**
   * A written loop restarts every pattern on each pass. Entering loop mode starts a pass;
   * a loop written while playing keeps the bar count (bar 3 stays bar 3 of the new
   * length); a shorter loop that the position already passed starts again here.
   */
  #advanceLoop(playback: Playback, bar: number, modeChanged: boolean): void {
    const length = loopLengthOf(this.#requireActive().program);
    if (playback.mode === "loop" && playback.rangeOwnsPass && !modeChanged) return;
    if (playback.mode !== "loop" || !length.declared) {
      playback.loopStart = null;
      return;
    }
    if (modeChanged) playback.loopStart = bar;
    else if (playback.loopStart === null) playback.loopStart = bar - (bar % length.bars);
    else if (bar - playback.loopStart >= length.bars) playback.loopStart = bar;
  }

  /** The play range step: the pure rule says where the ruler goes; this only moves the offset. */
  #applyPlayRange(playback: Playback, bar: number, current: number | null, modeChanged: boolean): void {
    const active = this.#requireActive();
    const change = playback.rangeChange;
    playback.rangeChange = null;
    const step = playRangeStep({
      mode: playback.mode,
      bar,
      current: modeChanged ? null : current,
      lastBar: lastBarOf(active.program, active.arrangement, playback.mode),
      songLoops: active.arrangement?.loops ?? false,
      range: this.#ranges[playback.mode],
      change,
      modeChanged,
      ownsPass: playback.rangeOwnsPass,
    });
    if (step.kind === "keep") return;
    if (playback.mode === "loop") playback.loopStart = step.offset;
    else playback.songStartBar = step.offset;
    playback.rangeOwnsPass = step.ownsPass;
  }

  /** Returns true when a structural program was activated (new generation). */
  #applyPendingProgram(): boolean {
    const pending = this.#pending;
    if (pending === null) return false;
    this.#pending = null;
    this.#activate(pending.program);
    if (pending.kind === "reseed") return false;
    this.#generation += 1;
    return true;
  }

  /** Part start or mode change: each constant gain at its effective value, 20 ms ramp. */
  #gainPoints(playback: Playback, bar: number): ParameterPoint[] {
    const frame = frameAt(playback.origin, wholeBar(bar));
    return this.#requireActive().program.tracks.flatMap((track, trackIndex) => {
      const gain = constantGain(track);
      const factor = this.#gainFactor(playback, track.name, bar);
      if (gain === null || factor === null) return [];
      return [
        {
          frame,
          generation: this.#generation,
          trackIndex,
          parameter: 0,
          value: gain * factor,
          rampFrames: this.#rampFrames,
          isConstant: true,
        },
      ];
    });
  }

  /** A "parameters" change: one point per changed constant, at now + 128, 20 ms ramp. */
  #sendParameterChanges(playback: Playback, next: Program): void {
    const baseline = this.#parameterBaseline;
    if (baseline === null) return;
    const now = this.#clock.nowFrame() ?? playback.scheduledUntil;
    const frame = Math.max(now + SAFETY_FRAMES, playback.startFrame);
    const bar = floorBar(playback.cursor);
    const points = changedParameters(baseline, next).map((change): ParameterPoint => {
      const name = next.tracks[change.trackIndex]?.name ?? "";
      const factor = this.#gainFactor(playback, name, bar) ?? 1;
      return {
        frame,
        generation: this.#generation,
        trackIndex: change.trackIndex,
        parameter: change.parameter,
        value: applyGainFactor(change.parameter, change.value, factor),
        rampFrames: this.#rampFrames,
        isConstant: true,
      };
    });
    if (points.length === 0) return;
    const position = playback.lastPosition ?? this.#positionAt(playback, bar);
    this.#sink.deliver({ events: [], parameters: points, position });
  }

  #activation(playback: Playback, bar: number): ProgramActivation {
    const { program } = this.#requireActive();
    const phase = this.#phaseStart(playback, bar);
    const originFrame = frameAt(playback.origin, wholeBar(phase));
    const barFrames = frameAt(playback.origin, wholeBar(bar + 1)) - frameAt(playback.origin, wholeBar(bar));
    return {
      generation: this.#generation,
      atFrame: frameAt(playback.origin, wholeBar(bar)),
      lightSourceHash: program.lightSourceHash,
      stagePlanHash: program.stagePlanHash,
      tracks: program.tracks.map((track) => {
        const gainFactor = this.#gainFactor(playback, track.name, bar) ?? 1;
        const parameters = parameterTableAt(track, rational(BigInt(bar - phase), 1n), program.sourceHash, gainFactor);
        const modulators = track.modulators.map((spec) => activatedModulator(spec, barFrames, originFrame, gainFactor));
        const isGainConstant = constantGain(track) !== null;
        return {
          name: track.name,
          instrument: track.instrument,
          parameters,
          effects: track.effects.map((effect) => EFFECT_KINDS.indexOf(effect)),
          modulators,
          isMuted: track.muted,
          isAudible: isAudibleActivation({ isMuted: track.muted, parameters, isGainConstant, modulators }),
        };
      }),
    };
  }

  #spanContext(playback: Playback): SpanContext {
    const compiled = this.#requireActive();
    const bar = floorBar(playback.cursor);
    const section = this.#sectionAt(playback, bar);
    const phaseStart = wholeBar(this.#phaseStart(playback, bar));
    return {
      compiled,
      origin: playback.origin,
      generation: this.#generation,
      members: section === null ? null : (compiled.sectionMembers.get(section.name) ?? null),
      sectionGain: section?.gain ?? 1,
      phaseStart,
      patternStart: wholeBar(playback.loopStart ?? 0),
      cycleOrigin: playback.mode === "song" ? phaseStart : ZERO,
    };
  }

  /**
   * Section.gain inside the current section (the part in song mode, the loop section in
   * loop mode), 1 with no section, null outside the section.
   */
  #gainFactor(playback: Playback, trackName: string, bar: number): number | null {
    const section = this.#sectionAt(playback, bar);
    if (section === null) return 1;
    return section.tracks.includes(trackName) ? section.gain : null;
  }

  /** What plays: the part's section in song mode, the loop section in loop mode. */
  #sectionAt(playback: Playback, bar: number): Section | null {
    if (playback.mode === "loop") return loopSectionOf(this.#requireActive().program);
    return this.#locationAt(playback, bar)?.part.section ?? null;
  }

  /** Song mode only; null in loop mode or past the end of a song without loop. */
  #locationAt(playback: Playback, bar: number): PartLocation | null {
    const arrangement = this.#active?.arrangement ?? null;
    if (playback.mode !== "song" || arrangement === null) return null;
    return locate(arrangement, bar - playback.songStartBar);
  }

  /** Signal phase origin: play (or the pass of a written loop) in loop mode, the part in song mode. */
  #phaseStart(playback: Playback, bar: number): number {
    const location = this.#locationAt(playback, bar);
    return location === null ? (playback.loopStart ?? 0) : bar - location.barInPart;
  }

  #tempoAt(playback: Playback, bar: number): Rational {
    const { program } = this.#requireActive();
    return this.#sectionAt(playback, bar)?.tempo ?? program.tempo;
  }

  #positionAt(playback: Playback, bar: number): PlaybackPosition {
    const location = this.#locationAt(playback, bar);
    const arrangement = this.#active?.arrangement ?? null;
    const loopBars = playback.mode === "loop" ? loopLengthOf(this.#requireActive().program).bars : null;
    const patternBar = bar - (playback.loopStart ?? 0);
    return {
      frame: frameAt(playback.origin, wholeBar(bar)),
      bar,
      patternBar,
      loopBar: loopBars === null ? null : patternBar % loopBars,
      loopBars,
      mode: playback.mode,
      partIndex: location?.partIndex ?? null,
      section: location?.part.section.name ?? null,
      barInPart: location?.barInPart ?? null,
      totalBars:
        location !== null && arrangement?.declared === true ? arrangement.totalBars : null,
      framesPerBar: frameAt(playback.origin, wholeBar(bar + 1)) - frameAt(playback.origin, wholeBar(bar)),
    };
  }

  /** Stopping or ending: the latest valid program becomes the active one. */
  #finishPlayback(): void {
    this.#playback = null;
    const pending = this.#pending;
    this.#pending = null;
    if (pending !== null) this.#activate(pending.program);
  }

  #requireActive(): CompiledProgram {
    const active = this.#active;
    if (active === null) throw new Error("Transport: no active program while playing");
    return active;
  }
}

/** The next bar boundary whose actions have not run: the cursor's own, or the one after it. */
function nextBoundary(playback: Playback): number {
  const at = boundaryOf(playback.cursor);
  return at !== null && at > playback.processedBoundary ? at : floorBar(playback.cursor) + 1;
}
function hasModulators(program: Program): boolean {
  return program.tracks.some((track: Track) => track.modulators.length > 0);
}

