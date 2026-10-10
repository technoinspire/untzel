// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  packBatch,
  previewMessages,
  toWorkletProgram,
  type PreviewCall,
  type WorkerToMainMessage,
  type WorkerToWorkletMessage,
} from "../protocol";
import type {
  ActivatedTrack,
  EventSink,
  ParameterPoint,
  PreviewSink,
  ProgramActivation,
  ScheduledBatch,
  ScheduledEvent,
  TempoChange,
} from "@untzel/session";

/** The subset of MessagePort / DedicatedWorkerGlobalScope the sink posts through. */
export interface MessageTarget<Message> {
  postMessage(message: Message, transfer: ArrayBuffer[]): void;
}

/**
 * Maps instrument to instrumentId, packs the batch and posts the same batch to both
 * threads: packed and transferred to the worklet, as objects to the main thread.
 */
export class WorkletEventSink implements EventSink, PreviewSink {
  readonly #worklet: MessageTarget<WorkerToWorkletMessage>;
  readonly #main: MessageTarget<WorkerToMainMessage>;
  readonly #instruments: readonly string[];

  constructor(
    worklet: MessageTarget<WorkerToWorkletMessage>,
    main: MessageTarget<WorkerToMainMessage>,
    instruments: readonly string[],
  ) {
    this.#worklet = worklet;
    this.#main = main;
    this.#instruments = instruments;
  }

  deliver(batch: ScheduledBatch): void {
    const data = packBatch(batch);
    this.#worklet.postMessage({ type: "batch", data }, [data.buffer]);
    this.#main.postMessage({ type: "batch", batch }, []);
  }

  programChanged(change: ProgramActivation): void {
    this.#worklet.postMessage(toWorkletProgram(change, this.#instruments), []);
    this.#main.postMessage({ type: "program", activation: change }, []);
  }

  tempoChanged(change: TempoChange): void {
    this.#worklet.postMessage({ type: "tempo", bpm: change.bpm, atFrame: change.atFrame }, []);
  }

  stopped(atFrame: number): void {
    this.#worklet.postMessage({ type: "stop", atFrame }, []);
  }

  ended(atFrame: number): void {
    this.#main.postMessage({ type: "ended", atFrame }, []);
  }

  previewStarted(track: ActivatedTrack, atFrame: number): void {
    this.#toWorklet({ kind: "started", track, atFrame });
  }

  /** To the worklet only: the audition never reaches the light, the feeds or the export. */
  previewScheduled(events: readonly ScheduledEvent[], points: readonly ParameterPoint[]): void {
    this.#toWorklet({ kind: "scheduled", events, points });
  }

  previewEnded(atFrame: number): void {
    this.#toWorklet({ kind: "ended", atFrame });
    this.#main.postMessage({ type: "previewEnded" }, []);
  }

  /** The audition's worklet messages, a packed batch transferred. */
  #toWorklet(call: PreviewCall): void {
    for (const message of previewMessages(call, this.#instruments)) {
      this.#worklet.postMessage(message, message.type === "batch" ? [message.data.buffer] : []);
    }
  }
}
