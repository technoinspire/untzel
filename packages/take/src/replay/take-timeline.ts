// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The seam with the export, in one place: the export worker and the simulator build a
// take's timeline with this function, so the browser's WAV and the simulator's never
// depend on two copies.
import type { ClockPort, EventSink, PreviewSink } from "@untzel/session";
import type { Take } from "../take";
import { takeSpan, type TakeOrigin } from "../take-span";
import { memoizedMaterialize } from "./memoized-materialize";
import type { Materialize, ReplayClock, ReplayPreview, ReplayTransport } from "./replay-ports";
import { rescalingPreviewSink, rescalingSink } from "./rescaling-sink";
import { TakeReplay } from "./take-replay";

const RENDER_QUANTUM = 128;
/** Programs kept by the replay's materialize (RNF6). */
const MATERIALIZED_PROGRAMS = 8;

export interface TakeTimelineParts {
  readonly materialize: Materialize;
  /** The clock is the replay clock seen as a ClockPort: nowFrame() = frame, staleness() = 0. */
  readonly createTransport: (clock: ClockPort, sink: EventSink) => ReplayTransport;
  /** null in the export worker (a take has no audition); the simulator passes PreviewTransport. */
  readonly createPreview: ((clock: ClockPort, sink: PreviewSink) => ReplayPreview) | null;
  /** Where sample 0 is: t0 (a take, and the simulator checking the page) or armFrame (the demo). */
  readonly origin: TakeOrigin;
  /** BACKGROUND_LOOKAHEAD_SECONDS of @untzel/transport, given to TakeReplay (runToSongEnd). */
  readonly maxLookaheadSeconds: number;
}

/** The same shape as @untzel/export's TimelineContext. */
export interface TimelineContext {
  readonly sink: EventSink;
  /** The DSP's audition slot; null when the renderer has none (the export worker). */
  readonly preview: PreviewSink | null;
  readonly sampleRate: number;
}

/** The same shape as @untzel/export's TimelineStart. */
export interface TimelineStart {
  /** Clock frame of the first quantum to render. */
  readonly firstFrame: number;
  /** Export sample 0; null: the first activation plus the plan's pre-roll (a program). */
  readonly musicStartFrame: number | null;
  /** A program export ends with the song; a take goes on to its own end (RF13). */
  readonly endsWithSong: boolean;
}

/** Satisfies @untzel/export's ExportTimeline by structure; export is not imported. */
export interface TakeTimeline {
  start(context: TimelineContext): TimelineStart;
  /** Before rendering the quantum at `frame` (renderer frames), every quantum. */
  advance(frame: number): void;
}

/** The replay clock and its ClockPort face, as the export's SimulatedClock. */
class FrameClock implements ReplayClock, ClockPort {
  readonly sampleRate: number;
  frame: number;
  constructor(sampleRate: number, frame: number) {
    this.sampleRate = sampleRate;
    this.frame = frame;
  }
  nowFrame(): number {
    return this.frame;
  }
  staleness(): number {
    return 0;
  }
}

export function takeTimeline(take: Take, parts: TakeTimelineParts): TakeTimeline {
  let replay: { readonly replay: TakeReplay; readonly rate: number } | null = null;
  return {
    start(context) {
      const span = takeSpan(take, parts.origin);
      if (span === null) throw new RangeError("take timeline: the take has no stretch to render");
      const rate = context.sampleRate;
      const toRenderer = (frame: number) => Math.round((frame * rate) / take.sampleRate);
      const clock = new FrameClock(take.sampleRate, take.armFrame);
      const transport = parts.createTransport(clock, rescalingSink(context.sink, take.sampleRate, rate));
      const preview =
        parts.createPreview === null || context.preview === null
          ? null
          : parts.createPreview(clock, rescalingPreviewSink(context.preview, take.sampleRate, rate));
      const materialize = memoizedMaterialize(parts.materialize, MATERIALIZED_PROGRAMS);
      replay = { replay: new TakeReplay(take, { transport, preview, clock, materialize, maxLookaheadSeconds: parts.maxLookaheadSeconds }), rate };
      return {
        firstFrame: Math.floor(toRenderer(take.armFrame) / RENDER_QUANTUM) * RENDER_QUANTUM,
        musicStartFrame: toRenderer(span.startFrame),
        endsWithSong: false,
      };
    },
    advance(frame) {
      if (replay === null) throw new Error("take timeline: advance before start");
      replay.replay.advanceTo(Math.round((frame * take.sampleRate) / replay.rate));
    },
  };
}
