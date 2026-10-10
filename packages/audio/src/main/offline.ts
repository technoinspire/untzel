// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Offline render with the same worklet as live playback: CPU calibration and audio
// export. Works before any user gesture.
import type { Program } from "@untzel/core";
import type { ClockPort, EventSink, PlaybackMode, ScheduledBatch } from "@untzel/session";
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  packBatch,
  toWorkletProgram,
  type MainToWorkletMessage,
  type ProcessorInit,
  type WorkerToWorkletMessage,
  type WorkletStats,
  type WorkletToMainMessage,
  type WorkletToWorkerMessage,
} from "../protocol";

/** Structural, like the worker's: audio does not import @untzel/transport. */
export interface OfflineTransport {
  setProgram(next: Program): void;
  play(mode?: PlaybackMode): unknown;
  tick(): void;
}

export type OfflineTransportFactory = (clock: ClockPort, sink: EventSink) => OfflineTransport;

/** Everything the worklet must receive before rendering starts. */
export type OfflineScore = readonly WorkerToWorkletMessage[];

const TICK_MS = 25;

/**
 * Runs a transport against a simulated clock and records what it would send to the
 * worklet over `seconds` of audio. Pure: no Web Audio involved.
 */
export function scheduleOffline(options: {
  readonly createTransport: OfflineTransportFactory;
  readonly program: Program;
  readonly instruments: readonly string[];
  readonly sampleRate: number;
  readonly seconds: number;
  readonly mode?: PlaybackMode;
}): OfflineScore {
  const { sampleRate, instruments } = options;
  const score: WorkerToWorkletMessage[] = [];
  let now = 0;
  const clock: ClockPort = { sampleRate, nowFrame: () => now, staleness: () => 0 };
  const sink: EventSink = {
    deliver: (batch: ScheduledBatch) => score.push({ type: "batch", data: packBatch(batch) }),
    programChanged: (change) => score.push(toWorkletProgram(change, instruments)),
    tempoChanged: ({ bpm, atFrame }) => score.push({ type: "tempo", bpm, atFrame }),
    stopped: (atFrame) => score.push({ type: "stop", atFrame }),
    ended: () => undefined,
  };
  const transport = options.createTransport(clock, sink);
  transport.setProgram(options.program);
  transport.play(options.mode ?? "loop");
  const end = Math.ceil(options.seconds * sampleRate);
  const step = Math.round((TICK_MS / 1000) * sampleRate);
  for (; now < end; now += step) transport.tick();
  return score;
}

export interface OfflineRenderOptions {
  readonly module: WebAssembly.Module;
  readonly workletUrl: string;
  /** fnv1a32 of each registry name, in instrumentId order. */
  readonly instrumentHashes: readonly number[];
  readonly sampleRate: number;
  readonly seconds: number;
  readonly score: OfflineScore;
}

export interface OfflineRender {
  readonly buffer: AudioBuffer;
  /** Wall time of startRendering, in milliseconds. */
  readonly renderMs: number;
  readonly audioSeconds: number;
  readonly stats: WorkletStats;
}

export async function renderOffline(options: OfflineRenderOptions): Promise<OfflineRender> {
  const length = Math.ceil(options.seconds * options.sampleRate);
  const context = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate: options.sampleRate,
  });
  await context.audioWorklet.addModule(options.workletUrl);
  const processorOptions: ProcessorInit = {
    module: options.module,
    protocol: PROTOCOL_VERSION,
    instrumentHashes: options.instrumentHashes,
  };
  const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions,
  });
  node.connect(context.destination);
  await waitReady(node);
  const channel = new MessageChannel();
  const connect: MainToWorkletMessage = { type: "connect", port: channel.port1 };
  node.port.postMessage(connect, [channel.port1]);
  for (const message of options.score) {
    channel.port2.postMessage(message, message.type === "batch" ? [message.data.buffer] : []);
  }
  // The port is ordered: the stats reply proves every score message was handled.
  await requestStats(channel.port2);
  const started = performance.now();
  const buffer = await context.startRendering();
  const renderMs = performance.now() - started;
  const stats = await requestStats(channel.port2);
  channel.port2.close();
  return { buffer, renderMs, audioSeconds: length / options.sampleRate, stats };
}

function waitReady(node: AudioWorkletNode): Promise<void> {
  return new Promise((resolve, reject) => {
    node.port.onmessage = (event: MessageEvent<WorkletToMainMessage>) => {
      const message = event.data;
      if (message.type === "ready") resolve();
      else if (message.type === "load-failed") reject(new Error(`Untzel worklet load failed: ${message.reason} ${message.detail}`));
    };
  });
}

function requestStats(port: MessagePort): Promise<WorkletStats> {
  return new Promise((resolve) => {
    port.onmessage = (event: MessageEvent<WorkletToWorkerMessage>) => {
      const message = event.data;
      if (typeof message !== "number" && message.type === "stats") resolve(message.stats);
    };
    const request: WorkerToWorkletMessage = { type: "statsRequest" };
    port.postMessage(request);
  });
}
