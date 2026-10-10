// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Worklet entry, bundled with ?worker&url into one file without imports.

import {
  FRAME_REPORT_INTERVAL_QUANTA,
  PROCESSOR_NAME,
  type MainToWorkletMessage,
  type ProcessorInit,
  type WorkerToWorkletMessage,
  type WorkletToMainMessage,
  type WorkletToWorkerMessage,
} from "../protocol";
import { DspHost, LoadFailure } from "./dsp-host";

/**
 * Renders the DSP. process() creates no object, closure, array or string and calls no
 * allocating export; the message handler may allocate.
 */
class UntzelProcessor extends AudioWorkletProcessor {
  readonly #host: DspHost | null = null;
  #clock: MessagePort | null = null;
  #quanta = 0;

  constructor(options: { readonly processorOptions: ProcessorInit }) {
    super();
    this.port.onmessage = (event: MessageEvent<MainToWorkletMessage>) => this.#fromMain(event.data);
    try {
      this.#host = new DspHost(options.processorOptions, sampleRate);
      this.#reply({ type: "ready" });
    } catch (error) {
      const failure =
        error instanceof LoadFailure ? error : new LoadFailure("instantiate", String(error));
      console.error("Untzel worklet failed to load:", failure.reason, failure.message);
      this.#reply({ type: "load-failed", reason: failure.reason, detail: failure.message });
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const host = this.#host;
    const channels = outputs[0];
    if (host === null || channels === undefined) return true;
    host.render(currentFrame);
    const left = channels[0];
    const right = channels[1];
    if (left !== undefined) left.set(host.left);
    if (right !== undefined) right.set(host.right);
    this.#quanta += 1;
    if (this.#quanta === FRAME_REPORT_INTERVAL_QUANTA) {
      this.#quanta = 0;
      if (this.#clock !== null) this.#clock.postMessage(currentFrame);
    }
    return true;
  }

  #reply(message: WorkletToMainMessage): void {
    this.port.postMessage(message);
  }

  #fromMain(message: MainToWorkletMessage): void {
    if (message.type === "connect") {
      this.#clock = message.port;
      this.#clock.onmessage = (event: MessageEvent<WorkerToWorkletMessage>) =>
        this.#fromWorker(event.data);
      return;
    }
    if (message.type === "masterGain") {
      this.#host?.masterGain(message.value);
      return;
    }
    if (message.type === "voiceBudget") {
      this.#host?.setVoiceBudget(message.budget);
      return;
    }
    if (message.type === "samplePackBegin") {
      this.#host?.beginSamples(message.instrumentId, message.frames, message.zones, message.sampleRate);
      this.#reply({ type: "samplePackTaken" });
      return;
    }
    if (message.type === "samplePackChunk") {
      this.#host?.copySamples(message.offset, message.pcm);
      this.#reply({ type: "samplePackTaken" });
      return;
    }
    if (message.type === "samplePackCommit") {
      const atFrame = this.#host?.commitSamples(currentFrame) ?? null;
      this.#reply({ type: "samplePack", instrumentId: message.instrumentId, atFrame });
      return;
    }
    this.#host?.countUnknownMessage();
  }

  #fromWorker(message: WorkerToWorkletMessage): void {
    const stats = this.#host?.receive(message, currentFrame) ?? null;
    if (stats !== null) {
      this.#clock?.postMessage({ type: "stats", stats } satisfies WorkletToWorkerMessage);
    }
  }
}

registerProcessor(PROCESSOR_NAME, UntzelProcessor);
