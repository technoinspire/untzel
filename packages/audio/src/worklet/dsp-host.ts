// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Drives one DSP WASM instance from worker messages. No AudioWorklet global is used here,
// so the same code runs inside UntzelProcessor and in the Node simulator (tools/sim):
// what the simulator renders is what the worklet renders.
// Over 300 lines: the worklet's DSP host; every message and the render quantum share one WASM instance on the audio thread.

import {
  BATCH_EVENT_STRIDE,
  BATCH_HEADER_LENGTH,
  BATCH_POINT_STRIDE,
  PROTOCOL_VERSION,
  type InstanceStats,
  type ProcessorInit,
  type SamplePackData,
  type WorkerToWorkletMessage,
  type VoiceBudget,
  type WorkletStats,
  type WorkletToMainMessage,
} from "../protocol";
import { nextBarFrame, withTempoMark, type TempoMark } from "./bar-grid";
import type { DspExports } from "./dsp-exports";
import { InstanceTable, NO_SLOT, UNKNOWN_TARGET, type ProgramMessage } from "./instance-table";
import { ChunkedUpload, uploadSamples } from "./sample-upload";
import { VoiceGovernor, type VoiceControl } from "./voice-governor";

export const QUANTUM = 128;
const OUTPUT_BYTES_PER_CHANNEL = QUANTUM * Float32Array.BYTES_PER_ELEMENT;

// Stats block cells (packages/dsp/ABI.md, "Memory layout").
const STAT_LATE_DROPS = 0;
const STAT_QUEUE_DROPS = 1;
const STAT_NAN_RESETS = 2;
const STAT_UNKNOWN_MESSAGES = 3;
const STAT_UNKNOWN_TARGETS = 4;
const STAT_SLOT_CAPACITY = 5;
const STAT_SLOT_BASE = 6;
const STAT_SLOT_STRIDE = 4;
/** Generation of the audition's events and points; its track index is ignored. */
export const PREVIEW_GENERATION = -1;
/**
 * The one name of the preview table (a new instrument retires the old slot) and of its
 * line in the stats; "#" keeps it apart from every track name.
 */
export const PREVIEW_INSTANCE = "#preview";
/** The CPU protection estimates the load every this many quanta. */
export const GOVERNOR_INTERVAL_QUANTA = 8;

export type FailureReason = Extract<WorkletToMainMessage, { readonly type: "load-failed" }>["reason"];

export class LoadFailure extends Error {
  readonly reason: FailureReason;

  constructor(reason: FailureReason, detail: string) {
    super(detail);
    this.reason = reason;
  }
}

function instantiate(init: ProcessorInit): DspExports {
  if (init.protocol !== PROTOCOL_VERSION) {
    throw new LoadFailure("protocol", `protocol ${String(init.protocol)}`);
  }
  try {
    return new WebAssembly.Instance(init.module, {}).exports as unknown as DspExports;
  } catch (error) {
    throw new LoadFailure("instantiate", String(error));
  }
}

function checkInstruments(dsp: DspExports, expected: readonly number[]): void {
  const count = dsp.untzel_instrument_count();
  const actual: number[] = [];
  for (let id = 0; id < count; id += 1) actual.push(dsp.untzel_instrument_name_hash(id) >>> 0);
  const same = actual.length === expected.length && actual.every((h, i) => h === expected[i]);
  if (!same) {
    throw new LoadFailure(
      "instrument-mismatch",
      `wasm [${actual.join(", ")}] vs registry [${expected.join(", ")}]`,
    );
  }
}

/**
 * One engine: instantiates the WASM, checks the instrument table, applies worker messages
 * and renders quanta. render() creates no object and calls no allocating export;
 * receive() may allocate (it runs in the message handler).
 */
export class DspHost {
  readonly #dsp: DspExports;
  readonly #upload: ChunkedUpload;
  readonly #table: InstanceTable;
  /** The audition's slot, apart from the program's names: a new program never retires it. */
  readonly #preview: InstanceTable;
  #buffer: ArrayBuffer | null = null;
  #left = new Float32Array(0);
  #right = new Float32Array(0);
  #stats = new Float64Array(0);
  #unknownMessages = 0;
  #unknownTargets = 0;
  readonly #governor = new VoiceGovernor();
  #quanta = 0;
  readonly #sampleRate: number;
  /** Bar lines of the music in play, for a sample pack that arrives mid-song. */
  #tempoMarks: readonly TempoMark[] = [];
  /** Created once, so a governor step in render() allocates nothing. */
  readonly #voiceControl: VoiceControl = {
    activeVoices: (slot) => {
      const index = STAT_SLOT_BASE + STAT_SLOT_STRIDE * slot;
      return index < this.#stats.length ? (this.#stats[index] ?? 0) : 0;
    },
    limitVoices: (slot, maxVoices) => {
      this.#dsp.untzel_voice_limit(slot, maxVoices);
    },
  };

  /** Throws LoadFailure. */
  constructor(init: ProcessorInit, sampleRate: number) {
    const dsp = instantiate(init);
    if (dsp.untzel_engine_new(sampleRate) !== 0) {
      throw new LoadFailure("instantiate", `untzel_engine_new(${String(sampleRate)})`);
    }
    checkInstruments(dsp, init.instrumentHashes);
    this.#dsp = dsp;
    this.#upload = new ChunkedUpload(dsp);
    this.#sampleRate = sampleRate;
    this.#table = new InstanceTable(dsp, sampleRate);
    this.#preview = new InstanceTable(dsp, sampleRate);
    this.#refreshViews();
  }

  /** Left channel of the last rendered quantum (a view into WASM memory). */
  get left(): Float32Array {
    return this.#left;
  }

  get right(): Float32Array {
    return this.#right;
  }

  render(frame: number): void {
    this.#dsp.untzel_render(frame, QUANTUM);
    this.#quanta += 1;
    if (this.#quanta === GOVERNOR_INTERVAL_QUANTA) {
      this.#quanta = 0;
      this.#governor.step(this.#voiceControl);
    }
  }

  /** The CPU protection starts with a calibration; null turns it off. Message handler only. */
  setVoiceBudget(budget: VoiceBudget | null): void {
    this.#governor.setBudget(budget);
  }

  masterGain(value: number): void {
    this.#dsp.untzel_master_gain(value);
  }

  countUnknownMessage(): void {
    this.#unknownMessages += 1;
  }

  /** Applies one worker message; returns the stats when they were asked for. */
  receive(message: WorkerToWorkletMessage, currentFrame: number): WorkletStats | null {
    const dsp = this.#dsp;
    const table = this.#table;
    switch (message.type) {
      case "program":
        table.activate(message);
        this.#governProgram(message);
        break;
      case "tempo":
        dsp.untzel_tempo(message.bpm, message.atFrame);
        this.#tempoMarks = withTempoMark(this.#tempoMarks, { frame: message.atFrame, bpm: message.bpm });
        break;
      case "batch":
        this.#pushBatch(message.data);
        dsp.untzel_collect();
        table.discardGenerations(currentFrame);
        break;
      case "stop":
        dsp.untzel_stop(message.atFrame);
        this.#tempoMarks = [];
        break;
      case "statsRequest":
        this.#refreshViews();
        return this.readStats(currentFrame);
      case "preview":
        this.#preview.activate({ type: "program", generation: PREVIEW_GENERATION, atFrame: message.atFrame, tracks: [{ ...message.track, name: PREVIEW_INSTANCE }] });
        break;
      case "previewStop":
        this.#preview.activate({ type: "program", generation: PREVIEW_GENERATION, atFrame: message.atFrame, tracks: [] });
        break;
      default:
        this.#unknownMessages += 1;
    }
    this.#refreshViews();
    return null;
  }

  /**
   * Copies a decoded sample pack into the DSP. Its instrument's notes play it
   * from the next bar line, or at once when nothing plays; a note already sounding keeps
   * its engine. Returns that frame, or null when the DSP refused the pack (unknown
   * instrument, one already loaded, a bad zone). Message handler only: allocates.
   */
  /** A whole pack at once: the export and the simulator, which have no audio thread to keep. */
  loadSamples(pack: SamplePackData, currentFrame: number): number | null {
    const atFrame = nextBarFrame(this.#tempoMarks, currentFrame, this.#sampleRate);
    const applied = uploadSamples(this.#dsp, pack, atFrame);
    this.#refreshViews();
    return applied ? atFrame : null;
  }
  /** A pack in pieces (main/sample-pack-sender.ts): the reserve may grow the memory. */
  beginSamples(instrumentId: number, frames: number, zones: Float64Array, sampleRate: number): void {
    this.#upload.begin(instrumentId, frames, zones, sampleRate);
    this.#refreshViews();
  }
  copySamples(offset: number, pcm: Int16Array): void {
    this.#upload.copy(offset, pcm);
  }
  /** Plays the pack from the next bar; null when the DSP refused it. */
  commitSamples(currentFrame: number): number | null {
    const atFrame = nextBarFrame(this.#tempoMarks, currentFrame, this.#sampleRate);
    const applied = this.#upload.commit(atFrame);
    this.#refreshViews();
    return applied ? atFrame : null;
  }

  readStats(frame: number): WorkletStats {
    const stats = this.#stats;
    const cell = (index: number): number => (index < stats.length ? (stats[index] ?? 0) : 0);
    this.#unknownTargets += this.#table.refusals.count + this.#preview.refusals.count;
    this.#table.refusals.count = 0;
    this.#preview.refusals.count = 0;
    if (stats.length > STAT_UNKNOWN_TARGETS) {
      stats[STAT_UNKNOWN_MESSAGES] = this.#unknownMessages;
      stats[STAT_UNKNOWN_TARGETS] = this.#unknownTargets;
    }
    const capacity = cell(STAT_SLOT_CAPACITY);
    const instances: InstanceStats[] = [];
    for (const [name, { slot }] of [...this.#table.instances(), ...this.#preview.instances()]) {
      if (slot === NO_SLOT || slot >= capacity) continue;
      const base = STAT_SLOT_BASE + STAT_SLOT_STRIDE * slot;
      instances.push({
        name,
        activeVoices: cell(base),
        onsetCount: cell(base + 1),
        lastOnsetFrame: cell(base + 2),
        voiceFrames: cell(base + 3),
      });
    }
    return {
      frame,
      lateDrops: cell(STAT_LATE_DROPS),
      queueDrops: cell(STAT_QUEUE_DROPS),
      nanResets: cell(STAT_NAN_RESETS),
      unknownMessages: this.#unknownMessages,
      unknownTargets: this.#unknownTargets,
      instances,
    };
  }

  /**
   * Level sums of every live instance since the last call (after gain, before pan;
   * untzel_slot_levels), and restarts them. Message handler only: allocates.
   */
  takeLevels(): { readonly name: string; readonly sumSquares: number; readonly frames: number; readonly peak: number }[] {
    const dsp = this.#dsp;
    const levels = [];
    for (const [name, { slot }] of this.#table.instances()) {
      if (slot === NO_SLOT || dsp.untzel_slot_levels(slot) !== 0) continue;
      const cells = new Float64Array(dsp.memory.buffer, dsp.untzel_levels_ptr(), 3);
      levels.push({ name, sumSquares: cells[0] ?? 0, frames: cells[1] ?? 0, peak: cells[2] ?? 0 });
    }
    return levels;
  }

  #governProgram(message: ProgramMessage): void {
    const tracks = message.tracks.flatMap((track, index) => {
      const slot = this.#table.slotOf(message.generation, index);
      return slot < 0 ? [] : [{ slot, instrumentId: track.instrumentId, gain: track.parameters[0] ?? 1 }];
    });
    this.#governor.configure(tracks);
  }

  #pushBatch(data: Float64Array): void {
    const dsp = this.#dsp;
    const eventCount = data[0] ?? 0;
    const pointCount = data[1] ?? 0;
    let offset = BATCH_HEADER_LENGTH;
    for (let i = 0; i < eventCount; i += 1, offset += BATCH_EVENT_STRIDE) {
      const slot = this.#target(data[offset + 2] ?? -1, data[offset + 3] ?? -1);
      if (slot === NO_SLOT) continue;
      dsp.untzel_event_push(
        slot,
        data[offset] ?? 0,
        data[offset + 1] ?? 0,
        data[offset + 4] ?? 0,
        data[offset + 5] ?? 0,
      );
    }
    for (let i = 0; i < pointCount; i += 1, offset += BATCH_POINT_STRIDE) {
      const slot = this.#target(data[offset + 1] ?? -1, data[offset + 2] ?? -1);
      if (slot === NO_SLOT) continue;
      dsp.untzel_param_push(
        slot,
        data[offset + 3] ?? 0,
        data[offset] ?? 0,
        data[offset + 4] ?? 0,
        data[offset + 5] ?? 0,
      );
    }
  }

  /** Slot of a (generation, trackIndex), or NO_SLOT when there is nothing to push to. */
  #target(generation: number, trackIndex: number): number {
    const slot = generation === PREVIEW_GENERATION ? this.#preview.slotOf(generation, 0) : this.#table.slotOf(generation, trackIndex);
    if (slot !== UNKNOWN_TARGET) return slot;
    this.#unknownTargets += 1;
    return NO_SLOT;
  }

  /** Recreates the views when memory grew or a pointer moved; message handler only. */
  #refreshViews(): void {
    const dsp = this.#dsp;
    const buffer = dsp.memory.buffer;
    const output = dsp.untzel_output_ptr();
    const statsPointer = dsp.untzel_stats_ptr();
    const statsLength = dsp.untzel_stats_len();
    if (
      buffer === this.#buffer &&
      this.#left.byteOffset === output &&
      this.#stats.byteOffset === statsPointer &&
      this.#stats.length === statsLength
    ) {
      return;
    }
    this.#buffer = buffer;
    this.#left = new Float32Array(buffer, output, QUANTUM);
    this.#right = new Float32Array(buffer, output + OUTPUT_BYTES_PER_CHANNEL, QUANTUM);
    this.#stats = new Float64Array(buffer, statsPointer, statsLength);
  }
}
