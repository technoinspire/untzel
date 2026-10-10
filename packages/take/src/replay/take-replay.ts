// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The replay of a take on a fresh transport, where the determinism lives: an entry is
// applied at its own frame, never at its horizon, and the transport is first scheduled
// exactly as far as it was live when it handled the command.
import type { Take, TakeCommand, TakeEntry } from "../take";
import { applyTextDiff } from "../text-diff";
import { REPLAY_AHEAD_SECONDS, type TakeReplayParts } from "./replay-ports";

const RENDER_QUANTUM = 128;
/** The transport's SAFETY_FRAMES: immediate points land this far after a command. */
const SAFETY_FRAMES = 128;
/** runToSongEnd schedules the song out in steps of this many frames. */
const SONG_END_STEP_FRAMES = 1024;

export type TakeReplayErrorCode = "UNPLAYABLE_TEXT" | "BAD_DIFF" | "DIVERGED" | "AUDITION_UNSUPPORTED";

export class TakeReplayError extends Error {
  readonly code: TakeReplayErrorCode;
  constructor(code: TakeReplayErrorCode, detail = "") {
    super(detail === "" ? `take replay: ${code}` : `take replay: ${code} (${detail})`);
    this.name = "TakeReplayError";
    this.code = code;
  }
}

export class TakeReplay {
  readonly #entries: readonly TakeEntry[];
  readonly #parts: TakeReplayParts;
  readonly #aheadFrames: number;
  readonly #songEndFrames: number;
  #next = 0;
  /** The source the last sounding entry rebuilt: the base of the next diff. */
  #text = "";

  constructor(take: Take, parts: TakeReplayParts) {
    const aheadFrames = Math.round(REPLAY_AHEAD_SECONDS * take.sampleRate);
    // On-time delivery: an entry's immediate points (frame + 128) must reach the renderer
    // before the quantum that holds them.
    if (aheadFrames < RENDER_QUANTUM + SAFETY_FRAMES) {
      throw new RangeError(`take replay: ${aheadFrames} frames ahead is under ${RENDER_QUANTUM + SAFETY_FRAMES}`);
    }
    this.#entries = take.entries;
    this.#parts = parts;
    this.#aheadFrames = aheadFrames;
    this.#songEndFrames = Math.round(parts.maxLookaheadSeconds * take.sampleRate) + RENDER_QUANTUM;
  }

  /** Applies every entry due and schedules up to frame + ahead, in take frames. */
  advanceTo(frame: number): void {
    const { transport, preview, clock } = this.#parts;
    let next = this.#entries[this.#next];
    while (next !== undefined && next.frame <= frame + this.#aheadFrames) {
      this.#enter(next);
      this.#next += 1;
      next = this.#entries[this.#next];
    }
    clock.frame = frame;
    // Never past the next entry's horizon: a structural change enters on the bar it entered live.
    transport.scheduleUntil(Math.min(frame + this.#aheadFrames, next?.horizon ?? Number.POSITIVE_INFINITY));
    preview?.tick();
  }

  #enter(entry: TakeEntry): void {
    const { transport, clock } = this.#parts;
    if (entry.horizon !== null) transport.scheduleUntil(entry.horizon);
    else if (transport.scheduledUntil() !== null) this.#runToSongEnd(entry.frame);
    clock.frame = entry.frame;
    this.#apply(entry.command);
    if (entry.startFrame !== undefined && transport.scheduledUntil() !== entry.startFrame) {
      throw new TakeReplayError("DIVERGED", `play started at ${String(transport.scheduledUntil())}, live at ${entry.startFrame}`);
    }
  }

  /**
   * Live, the transport was already stopped when it handled this entry (horizon null), and
   * the only way it stops without a stop entry is the song's end, found by a tick up to
   * one lookahead before the end sounds. The replay schedules on until its song ends too.
   */
  #runToSongEnd(atFrame: number): void {
    const { transport } = this.#parts;
    const limit = atFrame + this.#songEndFrames;
    for (let until = transport.scheduledUntil(); until !== null; until = transport.scheduledUntil()) {
      if (until >= limit) throw new TakeReplayError("DIVERGED", `the song did not end by frame ${limit}`);
      transport.scheduleUntil(Math.min(until + SONG_END_STEP_FRAMES, limit));
    }
  }

  /** TransportHost.receive, case by case and in the same order, so replay and live never part. */
  #apply(command: TakeCommand): void {
    const { transport, preview } = this.#parts;
    switch (command.kind) {
      case "sounding":
        transport.setProgram(this.#parts.materialize({ source: this.#rebuild(command.source), solo: command.solo, preview: command.preview }));
        return;
      case "play":
        preview?.stop();
        transport.play(command.mode, command.startBar === null ? undefined : { startBar: command.startBar });
        return;
      case "mode":
        transport.setMode(command.mode);
        return;
      case "stop":
        preview?.stop();
        transport.stop();
        return;
      case "background":
        transport.setBackground(command.isHidden);
        return;
      case "range":
        transport.setPlayRange(command.change);
        return;
      case "audition":
        // Live, a start that fails only posts previewEnded, which does not sound.
        this.#requirePreview().start(command.program, transport.beatGrid());
        return;
      case "auditionNote":
        this.#requirePreview().note(command.program, command.midis, command.seconds);
        return;
      case "auditionStop":
        this.#requirePreview().stop();
        return;
    }
  }

  #rebuild(diff: Extract<TakeCommand, { kind: "sounding" }>["source"]): string {
    try {
      this.#text = applyTextDiff(this.#text, diff);
    } catch (error: unknown) {
      if (error instanceof RangeError) throw new TakeReplayError("BAD_DIFF", error.message);
      throw error;
    }
    return this.#text;
  }

  #requirePreview(): NonNullable<TakeReplayParts["preview"]> {
    const preview = this.#parts.preview;
    if (preview === null) throw new TakeReplayError("AUDITION_UNSUPPORTED");
    return preview;
  }
}
