// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { fnv1a32, type InstrumentManifest } from "@untzel/core";
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  type MainToWorkerMessage,
  type MainToWorkletMessage,
  type ProcessorInit,
} from "../protocol";
import { createTransportWorker } from "../preload";
import { contextClock, type EngineClock } from "./engine-clock";
import type { EngineSound } from "./engine-sound";
import { LoadMeter } from "./load-meter";
import { SamplePackLoader, decodeWithWebAudio, samplesChoices, type SamplePackSource } from "./sample-packs";
import { WorkletSoundPort } from "./worklet-sound-port";

/** Asset URLs resolved by the composition (?worker&url, ?url), never by this package. */
export interface EngineUrls {
  /** The bundled UntzelProcessor (@untzel/audio/worklet?worker&url). */
  readonly worklet: string;
  /** The transport worker entry of the composition (?worker&url). */
  readonly worker: string;
}

export interface EngineOptions {
  /** Already unlocked by unlockAudio() inside the gesture. */
  readonly context: AudioContext;
  readonly urls: EngineUrls;
  /** Manifests in instrumentId order (registry order). */
  readonly instruments: readonly InstrumentManifest[];
  /** From compileDsp. */
  readonly module: WebAssembly.Module;
  /** Shared with the offline calibration, which may have finished already. */
  readonly meter?: LoadMeter;
  /** A transport worker made before the tap (preloadAudio), so its script is loaded. */
  readonly worker?: Worker;
  /** Sample packs, loaded when a program first uses their instrument. */
  readonly samplePacks?: readonly SamplePackSource[];
}

export interface Engine {
  readonly sound: EngineSound;
  /** The output clock every reader of musical time on the page uses. */
  readonly clock: EngineClock;
  readonly load: LoadMeter;
  readonly context: AudioContext;
  /** The worklet node, already connected to the destination (analysers tap it). */
  readonly output: AudioNode;
  /** The decoded sample packs, shared by the worklet and the export. */
  readonly samples: SamplePackLoader;
}

/** fnv1a32 of each name, in instrumentId order: what the worklet checks against the WASM. */
export function instrumentHashes(instruments: readonly InstrumentManifest[]): number[] {
  return instruments.map((manifest) => fnv1a32(manifest.name));
}

/** addModule, AudioWorkletNode, Worker and MessageChannel; returns the ports. */
// Over 40 lines: the engine's setup in its order (module, node, worker, channel); each step awaits or wires the one before.
export async function createEngine(options: EngineOptions): Promise<Engine> {
  const { context, urls, instruments, module } = options;
  await context.audioWorklet.addModule(urls.worklet);
  const processorOptions: ProcessorInit = {
    module,
    protocol: PROTOCOL_VERSION,
    instrumentHashes: instrumentHashes(instruments),
  };
  const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions,
  });
  node.connect(context.destination);
  const worker = options.worker ?? createTransportWorker(urls.worker);
  const sound = new WorkletSoundPort({ context, node, worker });

  const channel = new MessageChannel();
  const connect: MainToWorkletMessage = { type: "connect", port: channel.port1 };
  node.port.postMessage(connect, [channel.port1]);
  const init: MainToWorkerMessage = {
    type: "init",
    protocol: PROTOCOL_VERSION,
    port: channel.port2,
    sampleRate: context.sampleRate,
    instruments: instruments.map((manifest) => manifest.name),
  };
  worker.postMessage(init, [channel.port2]);

  const samples = new SamplePackLoader({
    sources: options.samplePacks ?? [],
    instruments: instruments.map((manifest) => manifest.name),
    samplesChoice: samplesChoices(instruments),
    decode: decodeWithWebAudio,
    fetch: (url) => fetch(url),
    onReady: (pack) => sound.sendSamples(pack),
  });
  sound.onLoad((program) => samples.want(program));
  followVisibility(sound);

  const load = options.meter ?? new LoadMeter(instruments);
  sound.onLoad((program) => load.track(program));
  sound.onStats((stats) => load.observe(stats));
  // The CPU protection uses the meter's numbers, so it starts with the calibration.
  const costs = instruments.map((manifest) => manifest.costPerVoice);
  load.onCalibrated(({ fixedFraction, fractionPerUnit }) => sound.setVoiceBudget({ fixedFraction, fractionPerUnit, costs }));
  return { sound, clock: contextClock(context), load, context, output: node, samples };
}
/** A hidden page schedules further ahead, so a throttled worker timer never lets the music cut. */
function followVisibility(sound: Pick<EngineSound, "setBackground">): void {
  if (typeof document === "undefined") return;
  const report = (): void => sound.setBackground(document.visibilityState === "hidden");
  document.addEventListener("visibilitychange", report);
  report();
}
