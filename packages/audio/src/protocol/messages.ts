// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Messages between the main thread, the transport worker and the audio worklet.
// Discriminated by `type`; a receiver ignores an unknown type and counts it in
// unknownMessages. The worklet reports its frame as a bare number, never an object.
import type { Program } from "@untzel/core";
import type {
  ActivatedModulator,
  PlaybackMode,
  PlayRangeChange,
  ProgramActivation,
  ScheduledBatch,
  TransportStats,
} from "@untzel/session";
import type { SamplePackData } from "./samples";

export const PROTOCOL_VERSION = 2;

/** Name passed to registerProcessor and to new AudioWorkletNode. */
export const PROCESSOR_NAME = "untzel-processor";

/** The worklet posts currentFrame to the worker every this many render quanta. */
export const FRAME_REPORT_INTERVAL_QUANTA = 8;

/** processorOptions of the AudioWorkletNode. */
export interface ProcessorInit {
  /** Compiled once on the main thread with compileStreaming. */
  readonly module: WebAssembly.Module;
  readonly protocol: typeof PROTOCOL_VERSION;
  /** fnv1a32 of each registry name, in instrumentId order; checked against the WASM. */
  readonly instrumentHashes: readonly number[];
}

// main -> worker

export type MainToWorkerMessage =
  | {
      readonly type: "init";
      readonly protocol: typeof PROTOCOL_VERSION;
      /** The worker end of the worker <-> worklet MessageChannel (transferred). */
      readonly port: MessagePort;
      readonly sampleRate: number;
      /** Registry names in instrumentId order. */
      readonly instruments: readonly string[];
    }
  | { readonly type: "load"; readonly program: Program }
  /** `startBar` (0-based) overrides where playback begins. */
  | { readonly type: "play"; readonly mode: PlaybackMode; readonly startBar?: number }
  | { readonly type: "setMode"; readonly mode: PlaybackMode }
  | { readonly type: "stop" }
  /** The page is hidden or visible again: the transport schedules further ahead while hidden. */
  | { readonly type: "background"; readonly isHidden: boolean }
  /** The play range of one mode: enters on the next unscheduled bar boundary. */
  | { readonly type: "setPlayRange"; readonly change: PlayRangeChange }
  /** The audition: the first track of a program the session built for it. */
  | { readonly type: "preview"; readonly program: Program }
  | { readonly type: "previewStop" }
  /** Note audition: one note or a chord on the first track of `program`, now, for `seconds`. */
  | { readonly type: "previewNote"; readonly program: Program; readonly midis: readonly number[]; readonly seconds: number }
  /**
   * Command receipts on or off: while on, the worker answers every message with a
   * receipt. This message answers its own: turning on, after switching; turning off, before.
   */
  | { readonly type: "receipts"; readonly isOn: boolean };

// main -> worklet (node.port)

export type MainToWorkletMessage =
  /** The worklet end of the worker <-> worklet MessageChannel (transferred). */
  | { readonly type: "connect"; readonly port: MessagePort }
  /** Not scheduled: applied directly with a 20 ms ramp. */
  | { readonly type: "masterGain"; readonly value: number }
  /** The CPU protection, once the meter is calibrated. */
  | { readonly type: "voiceBudget"; readonly budget: VoiceBudget }
  /**
   * A decoded sample pack, in pieces so the audio thread never stalls
   * (main/sample-pack-sender.ts): begin reserves, chunks copy, commit plays it from the next bar.
   */
  | { readonly type: "samplePackBegin"; readonly instrumentId: number; readonly frames: number; readonly sampleRate: number; readonly zones: Float64Array }
  | { readonly type: "samplePackChunk"; readonly offset: number; readonly pcm: Int16Array }
  | { readonly type: "samplePackCommit"; readonly instrumentId: number };

/** The meter calibration and the cost per voice of each instrument, by instrumentId. */
export interface VoiceBudget {
  readonly fixedFraction: number;
  readonly fractionPerUnit: number;
  readonly costs: readonly number[];
}

// worker -> worklet

export interface WorkletActivatedTrack {
  readonly name: string;
  readonly instrumentId: number;
  /** Indexed by DSP parameter index, as in ProgramActivation. */
  readonly parameters: readonly number[];
  /** Insert effects in chain order, DSP kind numbers. */
  readonly effects: readonly number[];
  readonly modulators: readonly ActivatedModulator[];
}

export type WorkerToWorkletMessage =
  | {
      readonly type: "program";
      readonly generation: number;
      readonly atFrame: number;
      readonly tracks: readonly WorkletActivatedTrack[];
    }
  | { readonly type: "tempo"; readonly bpm: number; readonly atFrame: number }
  /** packBatch layout, transferred. */
  | { readonly type: "batch"; readonly data: Float64Array<ArrayBuffer> }
  | { readonly type: "stop"; readonly atFrame: number }
  | { readonly type: "statsRequest" }
  /** Creates or recreates the preview slot; its events come in batches with generation −1. */
  | { readonly type: "preview"; readonly track: WorkletActivatedTrack; readonly atFrame: number }
  | { readonly type: "previewStop"; readonly atFrame: number };

// worklet -> worker

export interface InstanceStats {
  /** Track name of the instance. */
  readonly name: string;
  readonly activeVoices: number;
  readonly onsetCount: number;
  readonly lastOnsetFrame: number;
  /** Sum of activeVoices × frames over every render (packages/dsp/ABI.md); only grows. */
  readonly voiceFrames: number;
}

export interface WorkletStats {
  /** currentFrame when the stats were read: with voiceFrames, gives the average voices. */
  readonly frame: number;
  readonly lateDrops: number;
  readonly queueDrops: number;
  readonly nanResets: number;
  readonly unknownMessages: number;
  readonly unknownTargets: number;
  readonly instances: readonly InstanceStats[];
}

/** A bare number is currentFrame. */
export type WorkletToWorkerMessage = number | { readonly type: "stats"; readonly stats: WorkletStats };

// worklet -> main (node.port)

export type WorkletToMainMessage =
  | { readonly type: "ready" }
  /** A sample pack reached the DSP: its notes play it from atFrame; null when refused. */
  | { readonly type: "samplePack"; readonly instrumentId: number; readonly atFrame: number | null }
  /** A begin or a chunk of a sample pack was taken: the page sends the next piece. */
  | { readonly type: "samplePackTaken" }
  | {
      readonly type: "load-failed";
      readonly reason: "instantiate" | "instrument-mismatch" | "protocol";
      readonly detail: string;
    };

// worker -> main

/** Worklet and transport counters; unknownMessages is summed over the threads. */
export type EngineStats = WorkletStats & TransportStats;

export type WorkerToMainMessage =
  | { readonly type: "batch"; readonly batch: ScheduledBatch }
  /** Which track each (generation, trackIndex) of later batches names: the light layers. */
  | { readonly type: "program"; readonly activation: ProgramActivation }
  | { readonly type: "ended"; readonly atFrame: number }
  | { readonly type: "stats"; readonly stats: EngineStats }
  /** The audition ended: stopped, replaced, by play or stop, or after 16 bars. */
  | { readonly type: "previewEnded" }
  /** One handled message, while receipts are on. */
  | {
      readonly type: "receipt";
      readonly command: MainToWorkerMessage["type"];
      /** The held clock while the message was handled: every frame it produced came from this one. */
      readonly frame: number | null;
      /** scheduledUntil() BEFORE handling the message; null when stopped. */
      readonly horizon: number | null;
      /** scheduledUntil() AFTER handling: for a play that started, its startFrame. */
      readonly after: number | null;
    };
