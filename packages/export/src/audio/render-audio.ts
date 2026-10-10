// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sound of an export: a timeline (a program played by the real Transport, or a take
// replayed) on a simulated clock feeds the same DspHost and WASM the worklet runs,
// quantum by quantum, the loop of the simulator and of scheduleOffline.
// Time comes only from the sample count, never from the device.
import { PROTOCOL_VERSION, packBatch, toWorkletProgram, type SamplePackData } from "@untzel/audio/protocol";
import { DspHost, QUANTUM } from "@untzel/audio/dsp-host";
import type { EventSink, PreviewSink, ProgramActivation, ScheduledBatch, TempoChange } from "@untzel/session";
import type { ExportPlan } from "../plan";
import type { ExportTimeline, TimelineStart } from "../timeline";

export { programTimeline, type ExportTimeline, type TimelineContext, type TimelineStart } from "../timeline";

/** The end of a video's sound track: the card's last 500 ms carry the tails down to silence. */
export const VIDEO_FADE_FRAMES = 24_000;

export interface AudioRenderInput {
  readonly plan: ExportPlan;
  readonly module: WebAssembly.Module;
  readonly instruments: readonly string[];
  readonly instrumentHashes: readonly number[];
  readonly timeline: ExportTimeline;
  /**
   * The DSP's audition slot for the timeline (TimelineContext.preview). The DspHost is born
   * inside ExportAudio, so the factory receives it, with the render clock (48 kHz frames).
   * Absent: TimelineContext.preview is null (the export worker).
   */
  readonly createPreviewSink?: (host: DspHost, clock: { readonly frame: number }) => PreviewSink;
  /** Sample packs, in the DSP before the timeline starts: no bar on the formants. */
  readonly samplePacks?: readonly SamplePackData[];
  /** The light follows the same schedule: activations and the batches that were kept. */
  readonly onActivation?: (activation: ProgramActivation) => void;
  readonly onBatch?: (batch: ScheduledBatch) => void;
}

export interface AudioBlock {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

export interface DspCounters {
  readonly lateDrops: number;
  readonly queueDrops: number;
  readonly nanResets: number;
}

/** The frame being rendered: what the DSP is told each message arrives at. */
class SimulatedClock {
  frame = 0;
}

/** Forwards the schedule to the DSP, cut exactly at the end of the music. */
class ExportSink implements EventSink {
  startFrame: number | null = null;
  endFrame = Infinity;
  hasEnded = false;
  readonly #host: DspHost;
  readonly #clock: SimulatedClock;
  readonly #input: AudioRenderInput;

  constructor(host: DspHost, clock: SimulatedClock, input: AudioRenderInput) {
    this.#host = host;
    this.#clock = clock;
    this.#input = input;
  }

  /** A take says where its sample 0 is; a program's is found at its first activation. */
  startAt(musicStartFrame: number): void {
    this.startFrame = musicStartFrame;
    this.endFrame = musicStartFrame + this.#input.plan.musicFrames;
  }

  deliver(batch: ScheduledBatch): void {
    // The transport looks 120 ms ahead: the batch that crosses the end would bring the
    // first beat of the next bar. Nothing at or after the end sounds.
    const kept: ScheduledBatch = {
      events: batch.events.filter((event) => event.frame < this.endFrame),
      parameters: batch.parameters.filter((point) => point.frame < this.endFrame),
      position: batch.position,
    };
    this.#host.receive({ type: "batch", data: packBatch(kept) }, this.#clock.frame);
    this.#input.onBatch?.(kept);
  }

  programChanged(change: ProgramActivation): void {
    // The play starts on the pre-roll bar; export sample 0 is the bar after it.
    if (this.startFrame === null) this.startAt(change.atFrame + preRollFramesOf(this.#input.plan));
    this.#host.receive(toWorkletProgram(change, this.#input.instruments), this.#clock.frame);
    this.#input.onActivation?.(change);
  }

  tempoChanged(change: TempoChange): void {
    this.#host.receive({ type: "tempo", bpm: change.bpm, atFrame: change.atFrame }, this.#clock.frame);
  }

  stopped(atFrame: number): void {
    this.#host.receive({ type: "stop", atFrame }, this.#clock.frame);
  }

  ended(): void {
    this.hasEnded = true;
  }
}

/** A take has no pre-roll: its activation never waits for one. */
function preRollFramesOf(plan: ExportPlan): number {
  return plan.source.kind === "program" ? plan.source.preRollFrames : 0;
}

/**
 * Pull renderer of the export timeline: sample 0 is the first sample of the stretch (the
 * first of the program's start bar, or a step inside it, or a take's first sound),
 * exactly, after what comes before it is rendered and dropped. read(n) renders exactly n
 * more samples; after the music only the tails sound. A stretch cut into the music fades
 * in over its first `fadeInFrames`.
 */
export class ExportAudio {
  readonly musicFrames: number;
  readonly #host: DspHost;
  readonly #clock: SimulatedClock;
  readonly #sink: ExportSink;
  readonly #timeline: ExportTimeline;
  readonly #start: TimelineStart;
  readonly #preRollFrames: number;
  readonly #fadeInFrames: number;
  /** Samples of the export timeline handed out so far. */
  #read = 0;
  /** Clock frame of the next quantum to render. */
  #frame: number;
  /** Rendered samples of the current quantum not handed out yet. */
  #pendingLeft = new Float32Array(0);
  #pendingRight = new Float32Array(0);

  constructor(input: AudioRenderInput) {
    const { plan } = input;
    this.musicFrames = plan.musicFrames;
    this.#host = new DspHost(
      { module: input.module, protocol: PROTOCOL_VERSION, instrumentHashes: input.instrumentHashes },
      plan.sampleRate,
    );
    for (const pack of input.samplePacks ?? []) {
      if (this.#host.loadSamples(pack, 0) === null) console.warn(`export: the DSP refused the samples of instrument ${pack.instrumentId}`);
    }
    this.#clock = new SimulatedClock();
    this.#sink = new ExportSink(this.#host, this.#clock, input);
    this.#preRollFrames = preRollFramesOf(plan);
    this.#fadeInFrames = plan.source.kind === "program" ? plan.source.fadeInFrames : 0;
    this.#timeline = input.timeline;
    const preview = input.createPreviewSink?.(this.#host, this.#clock) ?? null;
    this.#start = this.#timeline.start({ sink: this.#sink, preview, sampleRate: plan.sampleRate });
    this.#frame = this.#start.firstFrame;
    this.#clock.frame = this.#frame;
    if (this.#start.musicStartFrame !== null) this.#sink.startAt(this.#start.musicStartFrame);
    this.#skipToStart();
  }

  /** The next `frames` samples of the export timeline. */
  read(frames: number): AudioBlock {
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    let written = 0;
    while (written < frames) {
      if (this.#pendingLeft.length === 0) this.#renderQuantum();
      const take = Math.min(frames - written, this.#pendingLeft.length);
      left.set(this.#pendingLeft.subarray(0, take), written);
      right.set(this.#pendingRight.subarray(0, take), written);
      this.#pendingLeft = this.#pendingLeft.subarray(take);
      this.#pendingRight = this.#pendingRight.subarray(take);
      written += take;
    }
    this.#fadeIn(left, right);
    this.#read += frames;
    return { left, right };
  }

  counters(): DspCounters {
    const stats = this.#host.readStats(this.#frame);
    return { lateDrops: stats.lateDrops, queueDrops: stats.queueDrops, nanResets: stats.nanResets };
  }

  /** Clock frame of export sample 0. */
  get startFrame(): number {
    return this.#sink.startFrame ?? 0;
  }

  /**
   * Renders and drops what comes before sample 0: the ≥ 120 ms the transport needs, the
   * pre-roll bar of a span, or a take from its arm to its first sound. Sample 0 is not on a
   * 128-sample quantum, so the quantum that holds it is kept from that sample on.
   */
  #skipToStart(): void {
    const { firstFrame, musicStartFrame } = this.#start;
    const limit = 1_000 + Math.ceil(((musicStartFrame ?? firstFrame) - firstFrame + this.#preRollFrames) / QUANTUM);
    for (let guard = 0; this.#sink.startFrame === null || this.#frame + QUANTUM <= this.#sink.startFrame; guard += 1) {
      if (guard > limit) throw new Error("export: the transport never started");
      this.#renderQuantum();
    }
    const quantumStart = this.#frame;
    this.#renderQuantum();
    const offset = (this.#sink.startFrame ?? quantumStart) - quantumStart;
    this.#pendingLeft = this.#pendingLeft.subarray(offset);
    this.#pendingRight = this.#pendingRight.subarray(offset);
  }

  /** A stretch cut into the music: a linear 10 ms ramp from 0, so its first sample never clicks. */
  #fadeIn(left: Float32Array, right: Float32Array): void {
    const end = Math.min(left.length, this.#fadeInFrames - this.#read);
    for (let index = 0; index < end; index += 1) {
      const gain = (this.#read + index) / this.#fadeInFrames;
      left[index] = (left[index] ?? 0) * gain;
      right[index] = (right[index] ?? 0) * gain;
    }
  }

  #renderQuantum(): void {
    const frame = this.#frame;
    this.#clock.frame = frame;
    const pastEnd = this.#sink.startFrame !== null && frame >= this.#sink.endFrame;
    if (!pastEnd && !(this.#sink.hasEnded && this.#start.endsWithSong)) this.#timeline.advance(frame);
    this.#host.render(frame);
    this.#pendingLeft = Float32Array.from(this.#host.left);
    this.#pendingRight = Float32Array.from(this.#host.right);
    this.#frame = frame + QUANTUM;
  }
}

/**
 * `totalFrames` of the export timeline in blocks of at most `blockFrames` (1 s), with a
 * linear fade to 0 over the last `fadeFrames`. Nothing keeps the whole music in float.
 */
export function* renderAudio(
  audio: ExportAudio,
  totalFrames: number,
  fadeFrames: number,
  blockFrames: number,
): Generator<AudioBlock> {
  for (let done = 0; done < totalFrames; done += blockFrames) {
    const frames = Math.min(blockFrames, totalFrames - done);
    const block = audio.read(frames);
    applyFade(block, done, totalFrames, fadeFrames);
    yield block;
  }
}

/** A macrotask turn, so worker messages (cancel) are handled during a long render. */
export function yieldToEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Linear gain from 1 to 0 across the last `fadeFrames` of `totalFrames`. */
export function applyFade(block: AudioBlock, offset: number, totalFrames: number, fadeFrames: number): void {
  const fadeStart = totalFrames - fadeFrames;
  for (let index = 0; index < block.left.length; index += 1) {
    const position = offset + index;
    if (position < fadeStart) continue;
    const gain = Math.max(0, (totalFrames - position) / fadeFrames);
    block.left[index] = (block.left[index] ?? 0) * gain;
    block.right[index] = (block.right[index] ?? 0) * gain;
  }
}
