// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The seam of the export's sound: what drives the transport while ExportAudio
// renders. A program plays from its start bar with a tick every 25 ms, as the live worker
// does; a take replays what was played. The take's timeline arrives from the composition,
// so the export never imports the take, the language nor the transport.
import type { Program } from "@untzel/core";
import type { ClockPort, EventSink, PlaybackMode, PreviewSink } from "@untzel/session";
import type { ExportPlan } from "./plan";

/** The worker ticks every 25 ms (packages/audio TICK_INTERVAL_MS); the export does the same. */
const TICK_SECONDS = 0.025;

/** What a program's timeline needs from the transport; the real Transport satisfies it by structure. */
export interface ExportTransport {
  setProgram(program: Program): void;
  play(mode: PlaybackMode, options: { readonly startBar: number }): { readonly ok: boolean };
  tick(): void;
}
/** Given by the composition root, like the live transport worker's factory. */
export type ExportTransportFactory = (clock: ClockPort, sink: EventSink) => ExportTransport;

export interface TimelineContext {
  readonly sink: EventSink;
  /** The DSP's audition slot; null when the renderer has none (the export worker). */
  readonly preview: PreviewSink | null;
  readonly sampleRate: number;
}

export interface TimelineStart {
  /** Clock frame of the first quantum to render. */
  readonly firstFrame: number;
  /** Export sample 0; null: the first activation plus the plan's pre-roll (a program). */
  readonly musicStartFrame: number | null;
  /** A program export ends with the song; a take goes on to its own end (RF13). */
  readonly endsWithSong: boolean;
}

export interface ExportTimeline {
  start(context: TimelineContext): TimelineStart;
  /** Before rendering the quantum at `frame` (48 kHz frames), every quantum. */
  advance(frame: number): void;
}

/** The render clock as the transport reads it: the frame ExportAudio is rendering. */
class RenderClock implements ClockPort {
  readonly sampleRate: number;
  frame = 0;
  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }
  nowFrame(): number {
    return this.frame;
  }
  staleness(): number {
    return 0;
  }
}

/** Today's path: setProgram, play(mode, { startBar }) and a tick every 25 ms on the clock. */
export function programTimeline(plan: ExportPlan, program: Program, createTransport: ExportTransportFactory): ExportTimeline {
  const { source } = plan;
  if (source.kind !== "program") throw new Error("export: a program timeline needs a program plan");
  let state: { readonly transport: ReturnType<ExportTransportFactory>; readonly clock: RenderClock; readonly tickFrames: number; nextTick: number } | null = null;
  return {
    start(context) {
      const clock = new RenderClock(context.sampleRate);
      const transport = createTransport(clock, context.sink);
      transport.setProgram(program);
      const playFrom = source.startBar - source.preRollBars;
      const played = transport.play(source.mode, { startBar: playFrom });
      if (!played.ok) throw new Error(`export: play(${source.mode}, ${playFrom}) failed`);
      state = { transport, clock, tickFrames: Math.round(TICK_SECONDS * context.sampleRate), nextTick: 0 };
      return { firstFrame: 0, musicStartFrame: null, endsWithSong: true };
    },
    advance(frame) {
      if (state === null) throw new Error("export: advance before start");
      state.clock.frame = frame;
      if (frame < state.nextTick) return;
      state.transport.tick();
      state.nextTick += state.tickFrames;
    },
  };
}
