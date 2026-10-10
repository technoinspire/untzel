// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Headless simulation: the real Transport on a simulated clock feeds the real DSP WASM
// through the same DspHost the worklet uses. Nothing here touches a browser.

import {
  PROTOCOL_VERSION,
  packBatch,
  toWorkletProgram,
  type SamplePackData,
  type VoiceBudget,
  type WorkerToWorkletMessage,
  type WorkletStats,
} from "@untzel/audio/protocol";
import { DspHost, QUANTUM } from "@untzel/audio/dsp-host";
import { fnv1a32, type EventValue, type Program } from "@untzel/core";
import type {
  ClockPort,
  EventSink,
  PlaybackMode,
  ProgramActivation,
  ScheduledBatch,
  TempoChange,
} from "@untzel/session";
import { Transport, type PlayRangeChange } from "@untzel/transport";

/** The worker ticks every 25 ms (packages/audio TICK_INTERVAL_MS). */
const TICK_SECONDS = 0.025;

export interface SimulatedEvent {
  readonly frame: number;
  readonly track: string;
  readonly instrument: string;
  readonly value: EventValue;
  readonly velocity: number;
  readonly from: number;
  readonly to: number;
}

export interface TempoSegment {
  readonly frame: number;
  readonly bpm: number;
  /** Bars since play at `frame`. */
  readonly bar: number;
}

export interface RenderedAudio {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

/** Level sums of one track before the master, over the whole run. */
export interface TrackLevels {
  readonly sumSquares: number;
  readonly frames: number;
  readonly peak: number;
}

export interface SimulationRun {
  readonly sampleRate: number;
  readonly mode: PlaybackMode;
  readonly startFrame: number | null;
  readonly frames: number;
  readonly events: readonly SimulatedEvent[];
  readonly tempo: readonly TempoSegment[];
  /** null when rendered without the DSP (events only). */
  readonly audio: RenderedAudio | null;
  readonly stats: WorkletStats | null;
  /** Per track name, after gain and before pan (empty without the DSP). */
  readonly levels: ReadonlyMap<string, TrackLevels>;
  readonly dspMs: number;
  readonly transportMs: number;
  readonly ended: boolean;
}

export interface SimulationInput {
  readonly program: Program;
  /** Registry names in instrumentId order. */
  readonly instruments: readonly string[];
  readonly instrumentHashes?: readonly number[];
  readonly mode: PlaybackMode;
  readonly sampleRate: number;
  /** Audio after the start frame. */
  readonly seconds: number;
  /** Without it only the schedule runs. */
  readonly wasm: WebAssembly.Module | null;
  /** Wall clock for render timings. */
  readonly now: () => number;
  /** Turns the CPU protection on, as a calibration does in the browser. */
  readonly voiceBudget?: VoiceBudget;
  /** A program the session loads while playing (a solo, an edit), at a frame of the run. */
  readonly programChange?: { readonly atFrame: number; readonly program: Program };
  /** Sample packs in the DSP before the music starts; none sings on the formants. */
  readonly samplePacks?: readonly SamplePackData[];
  /** A play range: before play when atFrame is 0, else handed in while playing. */
  readonly rangeChange?: { readonly atFrame: number; readonly change: PlayRangeChange };
}

class SimulatedClock implements ClockPort {
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

/** Records the schedule and forwards it to the DSP exactly as WorkletEventSink does. */
class RecordingSink implements EventSink {
  readonly events: SimulatedEvent[] = [];
  readonly tempo: TempoSegment[] = [];
  readonly #generations = new Map<number, ProgramActivation["tracks"]>();
  readonly #deliver: (message: WorkerToWorkletMessage) => void;
  readonly #instruments: readonly string[];
  readonly #sampleRate: number;
  startFrame: number | null = null;
  hasEnded = false;

  constructor(instruments: readonly string[], sampleRate: number, deliver: (message: WorkerToWorkletMessage) => void) {
    this.#instruments = instruments;
    this.#sampleRate = sampleRate;
    this.#deliver = deliver;
  }

  deliver(batch: ScheduledBatch): void {
    for (const event of batch.events) {
      const track = this.#generations.get(event.generation)?.[event.trackIndex];
      this.events.push({
        frame: event.frame,
        track: track?.name ?? `?${event.generation}:${event.trackIndex}`,
        instrument: track?.instrument ?? "?",
        value: event.value,
        velocity: event.velocity,
        from: event.source.from,
        to: event.source.to,
      });
    }
    this.#deliver({ type: "batch", data: packBatch(batch) });
  }

  programChanged(change: ProgramActivation): void {
    this.#generations.set(change.generation, change.tracks);
    this.#deliver(toWorkletProgram(change, this.#instruments));
  }

  tempoChanged(change: TempoChange): void {
    this.startFrame ??= change.atFrame;
    const previous = this.tempo.at(-1);
    const bar =
      previous === undefined
        ? 0
        : previous.bar + ((change.atFrame - previous.frame) * previous.bpm) / (240 * this.#sampleRate);
    this.tempo.push({ frame: change.atFrame, bpm: change.bpm, bar });
    this.#deliver({ type: "tempo", bpm: change.bpm, atFrame: change.atFrame });
  }

  stopped(atFrame: number): void {
    this.#deliver({ type: "stop", atFrame });
  }

  ended(): void {
    this.hasEnded = true;
  }
}

/** Slot levels are read this often, so a slot freed later still counts (quanta). */
const LEVEL_READ_QUANTA = 64;

function addLevels(host: DspHost, into: Map<string, TrackLevels>): void {
  for (const level of host.takeLevels()) {
    const previous = into.get(level.name) ?? { sumSquares: 0, frames: 0, peak: 0 };
    into.set(level.name, {
      sumSquares: previous.sumSquares + level.sumSquares,
      frames: previous.frames + level.frames,
      peak: Math.max(previous.peak, level.peak),
    });
  }
}

/** The transport refused the mode (a text without a song cannot play song): the command line says it in one line. */
export class PlayRefused extends Error {
  readonly mode: PlaybackMode;
  readonly code: string;
  constructor(mode: PlaybackMode, code: string) {
    super(`play(${mode}) failed: ${code}`);
    this.mode = mode;
    this.code = code;
  }
}
/** Renders `seconds` of the program after the start frame. */
// Over 40 lines: the simulator's render loop in the worklet's order, quantum by quantum; a split would move the transport against the DSP.
export function simulate(input: SimulationInput): SimulationRun {
  const { sampleRate, now } = input;
  const host =
    input.wasm === null
      ? null
      : new DspHost(
          {
            module: input.wasm,
            protocol: PROTOCOL_VERSION,
            instrumentHashes: input.instrumentHashes ?? input.instruments.map((name) => fnv1a32(name)),
          },
          sampleRate,
        );
  if (input.voiceBudget !== undefined) host?.setVoiceBudget(input.voiceBudget);
  for (const pack of input.samplePacks ?? []) {
    if (host?.loadSamples(pack, 0) === null) throw new Error(`the DSP refused the samples of instrument ${pack.instrumentId}`);
  }
  const clock = new SimulatedClock(sampleRate);
  const sink = new RecordingSink(input.instruments, sampleRate, (message) => host?.receive(message, clock.frame));
  const transport = new Transport({ clock, sink });
  transport.setProgram(input.program);
  const range = input.rangeChange;
  if (range !== undefined && range.atFrame <= 0) transport.setPlayRange(range.change);
  const played = transport.play(input.mode);
  if (!played.ok) throw new PlayRefused(input.mode, played.code);

  const tickFrames = Math.round(TICK_SECONDS * sampleRate);
  // play() starts at least 120 ms ahead on a multiple of 128; render that much plus the audio.
  const leadFrames = Math.ceil((0.12 * sampleRate + QUANTUM) / QUANTUM) * QUANTUM;
  const totalFrames = Math.ceil((leadFrames + input.seconds * sampleRate) / QUANTUM) * QUANTUM;
  const left = host === null ? null : new Float32Array(totalFrames);
  const right = host === null ? null : new Float32Array(totalFrames);
  let nextTick = 0;
  let dspMs = 0;
  let transportMs = 0;
  const levels = new Map<string, TrackLevels>();
  for (let frame = 0, quantum = 0; frame < totalFrames; frame += QUANTUM, quantum += 1) {
    if (host !== null && quantum % LEVEL_READ_QUANTA === 0) addLevels(host, levels);
    clock.frame = frame;
    const change = input.programChange;
    if (change !== undefined && frame <= change.atFrame && change.atFrame < frame + QUANTUM) transport.setProgram(change.program);
    if (range !== undefined && range.atFrame > 0 && frame <= range.atFrame && range.atFrame < frame + QUANTUM) transport.setPlayRange(range.change);
    if (frame >= nextTick) {
      const started = now();
      transport.tick();
      transportMs += now() - started;
      nextTick += tickFrames;
    }
    if (host === null || left === null || right === null) continue;
    const started = now();
    host.render(frame);
    dspMs += now() - started;
    left.set(host.left, frame);
    right.set(host.right, frame);
  }
  if (host !== null) addLevels(host, levels);
  return {
    sampleRate,
    mode: input.mode,
    startFrame: sink.startFrame,
    frames: totalFrames,
    // The transport looks 120 ms ahead; keep what falls inside the rendered audio.
    events: sink.events.filter((event) => event.frame < totalFrames),
    tempo: sink.tempo,
    audio: left === null || right === null ? null : { left, right },
    stats: host?.readStats(totalFrames) ?? null,
    levels,
    dspMs,
    transportMs,
    ended: sink.hasEnded,
  };
}
