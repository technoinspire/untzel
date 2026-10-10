// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range use cases: set, clear, Play from here and
// a part's Play. The range is playback state: no use case here ever touches the text.
// One range per mode, written to the mode asked for (the Loop / Song switch); the
// transport applies it on the next bar. Beside the Session, never inside it: it reads
// the session's view and plays through it, and sends ranges through its own small port.
import { buildArrangement, type Arrangement, type Program } from "@untzel/core";
import {
  clampPlayRange,
  createPlayRange,
  extendRangeToPart,
  isPlayRange,
  isRangeOfPart,
  lastBarOf,
  playFromBar,
  rangeOfPart,
  rangePartNames,
  type PlaybackMode,
  type PlayRange,
  type PlayRangeChange,
  type RangePartNames,
} from "@untzel/transport";
import type { CarriedRange } from "../opening-mode";
import type { Unsubscribe } from "../ports";
import type { CommandResult, SessionResult, SessionState } from "./session";

/** What the use cases need from the Session. */
export interface PlayRangeHost {
  state(): SessionState;
  play(mode?: PlaybackMode): SessionResult;
  subscribe(listener: () => void): Unsubscribe;
}

/** The one call of SoundPort these use cases make. */
export interface PlayRangeSound {
  setPlayRange(change: PlayRangeChange): void;
}

export type PlayRangeRequest =
  | { readonly kind: "bars"; readonly startBar: number; readonly endBar: number }
  /** The bracket button: the range becomes that part. */
  | { readonly kind: "part"; readonly partIndex: number }
  /** To here: the range grows to cover the part. */
  | { readonly kind: "extendToPart"; readonly partIndex: number }
  /** Song mode: repeat the range, or play on into the song. */
  | { readonly kind: "cycle"; readonly cycle: boolean };

export type PlayRangeFailure = "NO_PROGRAM" | "SONG_UNAVAILABLE" | "INVALID_RANGE" | "UNKNOWN_PART";
export type PlayRangeResult = { readonly ok: true } | { readonly ok: false; readonly code: PlayRangeFailure };

/** A range the session had to cut after an edit: announced once per id. */
export interface PlayRangeNotice {
  readonly id: number;
  readonly mode: PlaybackMode;
  readonly range: PlayRange;
  readonly lastBar: number;
}

export interface PlayRangeView {
  /** The mode the ranges are edited in: the one asked for. */
  readonly mode: PlaybackMode;
  /** The range of that mode, clamped; null without one (or a song range waiting for a song). */
  readonly range: PlayRange | null;
  readonly loop: PlayRange | null;
  readonly song: PlayRange | null;
  /** The last bar of that mode's ruler; null in song mode without a song. */
  readonly lastBar: number | null;
  /** The parts at the ends of the song range, when both ends fall on part boundaries. */
  readonly songNames: RangePartNames | null;
  readonly notice: PlayRangeNotice | null;
}

/** What a link, a file or a saved session carries beside the text. */
export interface PlaybackRanges {
  readonly loop: PlayRange | null;
  readonly song: PlayRange | null;
}

const OK = { ok: true } as const;
const failure = (code: PlayRangeFailure): PlayRangeResult => ({ ok: false, code });

export class PlayRanges {
  readonly #host: PlayRangeHost;
  readonly #sound: PlayRangeSound;
  readonly #listeners = new Set<() => void>();
  readonly #unsubscribe: Unsubscribe;
  #ranges: Record<PlaybackMode, PlayRange | null> = { loop: null, song: null };
  #notice: PlayRangeNotice | null = null;
  #noticeId = 0;
  #program: Program | null = null;
  #arrangement: Arrangement | null = null;
  #view: PlayRangeView | null = null;

  constructor(host: PlayRangeHost, sound: PlayRangeSound) {
    this.#host = host;
    this.#sound = sound;
    this.#unsubscribe = host.subscribe(() => this.#onSession());
    this.#onSession();
  }

  set(request: PlayRangeRequest): PlayRangeResult {
    const mode = this.#mode();
    const lastBar = this.#lastBar(mode);
    if (this.#program === null) return failure("NO_PROGRAM");
    if (lastBar === null) return failure("SONG_UNAVAILABLE");
    const next = this.#resolve(request, mode, lastBar);
    if ("code" in next) return failure(next.code);
    this.#store(mode, clampPlayRange(next, lastBar).range, false);
    return OK;
  }

  clear(): PlayRangeResult {
    if (this.#program === null) return failure("NO_PROGRAM");
    this.#store(this.#mode(), null, false);
    return OK;
  }

  /** Moves only the start; the music goes there on the next bar. Stopped, it plays. */
  playFrom(bar: number): PlayRangeResult {
    const mode = this.#mode();
    const lastBar = this.#lastBar(mode);
    if (this.#program === null) return failure("NO_PROGRAM");
    if (lastBar === null) return failure("SONG_UNAVAILABLE");
    if (!Number.isInteger(bar) || bar < 1 || bar > lastBar) return failure("INVALID_RANGE");
    this.#store(mode, playFromBar(this.#ranges[mode], bar, lastBar, mode), true);
    return this.#playIfStopped(mode);
  }

  /** The part editor's Play from here: the song range starts at the part; stopped, the song plays. */
  playFromPart(partIndex: number): PlayRangeResult {
    const arrangement = this.#arrangement;
    if (this.#program === null) return failure("NO_PROGRAM");
    if (arrangement === null) return failure("SONG_UNAVAILABLE");
    const part = arrangement.parts[partIndex];
    if (part === undefined) return failure("UNKNOWN_PART");
    this.#store("song", playFromBar(this.#ranges.song, part.start + 1, arrangement.totalBars, "song"), true);
    return this.#playIfStopped("song");
  }

  /**
   * A part's Play: the range becomes that part with Cycle on, so it repeats
   * alone from the next bar; on the part already repeating it clears the range.
   */
  playPart(partIndex: number): PlayRangeResult {
    const arrangement = this.#arrangement;
    if (this.#program === null) return failure("NO_PROGRAM");
    if (arrangement === null) return failure("SONG_UNAVAILABLE");
    const part = rangeOfPart(arrangement, partIndex, true);
    if (part === null) return failure("UNKNOWN_PART");
    const playing = this.#host.state().playing;
    if (playing && this.#mode() === "song" && isRangeOfPart(this.#ranges.song, arrangement, partIndex)) {
      this.#store("song", null, false);
      return OK;
    }
    this.#store("song", part, true);
    return this.#playIfStopped("song");
  }

  view(): PlayRangeView {
    if (this.#view !== null) return this.#view;
    const mode = this.#mode();
    const lastBar = this.#lastBar(mode);
    const loop = this.#ranges.loop;
    const song = this.#arrangement === null ? null : this.#ranges.song;
    const songNames = song === null || this.#arrangement === null ? null : rangePartNames(song, this.#arrangement);
    this.#view = { mode, range: mode === "loop" ? loop : song, loop, song, lastBar, songNames, notice: this.#notice };
    return this.#view;
  }

  /** The range a link, a file or a project carries beside `mode`: the one the view shows; null without a mode. */
  rangeOf(mode: PlaybackMode | null): PlayRange | null {
    return mode === null ? null : this.view()[mode];
  }

  /**
   * A range that arrived with a link, a file or a project replaces the range of its mode,
   * validated and cut by restore; without one nothing changes, as before the range travelled.
   */
  receive(carried: CarriedRange | null): void {
    if (carried === null) return;
    this.restore({ ...this.playbackRanges(), [carried.mode]: carried.range });
  }

  playbackRanges(): PlaybackRanges {
    return { loop: this.#ranges.loop, song: this.#ranges.song };
  }

  /** From a link, a file or a saved session: validated, cut to what arrived, sent to the transport. */
  restore(ranges: PlaybackRanges): void {
    for (const mode of ["loop", "song"] as const) {
      const range = ranges[mode];
      const valid = range === null ? null : createPlayRange(range.startBar, range.endBar, mode === "loop" ? true : range.cycle);
      this.#ranges[mode] = valid !== null && isPlayRange(valid) ? valid : null;
      this.#sound.setPlayRange({ mode, range: this.#ranges[mode], locate: false });
    }
    this.#clampAll();
    this.#changed();
  }

  subscribe(listener: () => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#unsubscribe();
    this.#listeners.clear();
  }

  #resolve(request: PlayRangeRequest, mode: PlaybackMode, lastBar: number): PlayRange | { readonly code: PlayRangeFailure } {
    const current = this.#ranges[mode];
    if (request.kind === "bars") {
      const created = createPlayRange(request.startBar, request.endBar, mode === "loop" ? true : (current?.cycle ?? true));
      return isPlayRange(created) && created.startBar <= lastBar ? created : { code: "INVALID_RANGE" };
    }
    if (request.kind === "cycle") {
      if (mode === "loop" || current === null) return { code: "INVALID_RANGE" };
      return { ...current, cycle: request.cycle };
    }
    const arrangement = this.#arrangement;
    if (mode !== "song" || arrangement === null) return { code: "SONG_UNAVAILABLE" };
    const range =
      request.kind === "part"
        ? rangeOfPart(arrangement, request.partIndex, current?.cycle ?? true)
        : extendRangeToPart(current, arrangement, request.partIndex);
    return range ?? { code: "UNKNOWN_PART" };
  }

  #store(mode: PlaybackMode, range: PlayRange | null, locate: boolean): void {
    this.#ranges[mode] = range;
    this.#sound.setPlayRange({ mode, range, locate });
    this.#changed();
  }

  #playIfStopped(mode: PlaybackMode): PlayRangeResult {
    if (this.#host.state().playing && this.#mode() === mode) return OK;
    const played = this.#host.play(mode);
    return played.ok ? OK : failure(played.code);
  }

  /** A new program: ranges that no longer fit are cut, sent and announced, never dropped. */
  #onSession(): void {
    const program = this.#host.state().program;
    const mode = this.#mode();
    if (program === this.#program && mode === this.#view?.mode) return;
    if (program !== this.#program) {
      this.#program = program;
      this.#arrangement = program === null ? null : buildArrangement(program);
      this.#clampAll();
    }
    this.#changed();
  }

  #clampAll(): void {
    for (const mode of ["loop", "song"] as const) {
      const range = this.#ranges[mode];
      const lastBar = this.#lastBar(mode);
      if (range === null || lastBar === null) continue; // a song range waits for a song
      const clamped = clampPlayRange(range, lastBar);
      if (!clamped.changed) continue;
      this.#ranges[mode] = clamped.range;
      this.#sound.setPlayRange({ mode, range: clamped.range, locate: false });
      this.#noticeId += 1;
      this.#notice = { id: this.#noticeId, mode, range: clamped.range, lastBar };
    }
  }

  /** The mode asked for; before any play, the one play() would choose. */
  #mode(): PlaybackMode {
    const state = this.#host.state();
    if (state.mode !== null) return state.mode;
    return (state.program?.sections.length ?? 0) > 0 ? "song" : "loop";
  }

  #lastBar(mode: PlaybackMode): number | null {
    const program = this.#program;
    return program === null ? null : lastBarOf(program, this.#arrangement, mode);
  }

  #changed(): void {
    this.#view = null;
    for (const listener of this.#listeners) listener();
  }
}
