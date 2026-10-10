// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program } from "@untzel/core";
import type {
  PlaybackMode,
  PlaybackPosition,
  PlayRangeChange,
  ProgramActivation,
  StartResult,
  Unsubscribe,
} from "@untzel/session";
import type {
  EngineStats,
  MainToWorkerMessage,
  MainToWorkletMessage,
  SamplePackData,
  VoiceBudget,
  WorkerToMainMessage,
  WorkletToMainMessage,
} from "../protocol";
import { CommandLog } from "./command-log";
import { CommandWatchSlot, type CommandWatch, type CommandWatcher } from "./command-watch";
import type { EngineSound, SamplesLoaded, ScheduledFeed } from "./engine-sound";
import { Listeners } from "./listeners";
import { SamplePackSender } from "./sample-pack-sender";

/** The worklet never answering is a load failure, not an endless spinner. */
export const READY_TIMEOUT_MS = 10_000;


export interface WorkletSoundPortParts {
  readonly context: AudioContext;
  readonly node: AudioWorkletNode;
  readonly worker: Worker;
}

/** SoundPort over the worklet node and the transport worker. Main thread. */
export class WorkletSoundPort implements EngineSound {
  readonly #context: AudioContext;
  readonly #node: AudioWorkletNode;
  readonly #packs: SamplePackSender;
  readonly #worker: Worker;
  readonly #ready: Promise<boolean>;
  readonly #positions = new Listeners<PlaybackPosition>();
  readonly #ended = new Listeners<void>();
  readonly #previewEnded = new Listeners<void>();
  readonly #feeds = new Listeners<ScheduledFeed>();
  readonly #stats = new Listeners<EngineStats>();
  readonly #programs = new Listeners<Program>();
  readonly #activations = new Listeners<ProgramActivation>();
  readonly #samples = new Listeners<SamplesLoaded>();
  readonly #log = new CommandLog();
  readonly #watch = new CommandWatchSlot({ send: (message) => this.#toWorker(message), reaffirmation: () => this.#log.reaffirmation() });
  #failed = false;

  constructor({ context, node, worker }: WorkletSoundPortParts) {
    this.#context = context;
    this.#node = node;
    this.#packs = new SamplePackSender(node.port);
    this.#worker = worker;
    this.#ready = this.#watchWorklet();
    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => this.#fromWorker(event.data);
    worker.onerror = (event) => {
      console.error("Untzel transport worker failed:", event.message);
      this.#failed = true;
      this.#watch.lost();
      this.#ended.emit();
    };
  }

  async start(): Promise<StartResult> {
    if (!(await this.#ready) || this.#failed) return { ok: false, reason: "load-failed" };
    if (this.#context.state !== "running") {
      try {
        await this.#context.resume();
      } catch (error) {
        console.warn("Untzel: resume() rejected", error);
      }
    }
    if (this.#context.state !== "running") {
      console.warn("Untzel: AudioContext is", this.#context.state, "after the gesture");
      return { ok: false, reason: "blocked" };
    }
    return { ok: true };
  }

  load(program: Program): void {
    this.#toWorker({ type: "load", program });
    this.#programs.emit(program);
  }

  play(mode: PlaybackMode, startBar?: number): void {
    this.#toWorker(startBar === undefined ? { type: "play", mode } : { type: "play", mode, startBar });
  }

  setMode(mode: PlaybackMode): void {
    this.#toWorker({ type: "setMode", mode });
  }

  stop(): void {
    this.#toWorker({ type: "stop" });
  }

  setPlayRange(change: PlayRangeChange): void {
    this.#toWorker({ type: "setPlayRange", change });
  }

  /** The page is hidden (minimized, another tab) or visible again (BACKGROUND_LOOKAHEAD_SECONDS). */
  setBackground(isHidden: boolean): void {
    this.#toWorker({ type: "background", isHidden });
  }
  setMasterGain(value: number): void {
    const message: MainToWorkletMessage = { type: "masterGain", value };
    this.#node.port.postMessage(message);
  }
  /** A decoded sample pack for the worklet, in pieces (sample-pack-sender.ts); the page keeps it for the export. */
  sendSamples(pack: SamplePackData): void {
    this.#packs.send(pack);
  }

  /** The worklet took (or refused) a sample pack. */
  onSamplesLoaded(listener: (loaded: SamplesLoaded) => void): Unsubscribe {
    return this.#samples.add(listener);
  }

  /** Starts the CPU protection in the worklet. */
  setVoiceBudget(budget: VoiceBudget): void {
    const message: MainToWorkletMessage = { type: "voiceBudget", budget };
    this.#node.port.postMessage(message);
  }

  onPosition(listener: (position: PlaybackPosition) => void): Unsubscribe {
    return this.#positions.add(listener);
  }

  onEnded(listener: () => void): Unsubscribe {
    return this.#ended.add(listener);
  }
  preview(program: Program): void {
    this.#toWorker({ type: "preview", program });
  }
  previewNote(program: Program, midis: readonly number[], seconds: number): void {
    this.#toWorker({ type: "previewNote", program, midis, seconds });
  }
  stopPreview(): void {
    this.#toWorker({ type: "previewStop" });
  }
  onPreviewEnded(listener: () => void): Unsubscribe {
    return this.#previewEnded.add(listener);
  }

  /** Every batch the worker scheduled, with what the light engine needs to sync. */
  onScheduled(listener: (feed: ScheduledFeed) => void): Unsubscribe {
    return this.#feeds.add(listener);
  }

  /** Every program activation, so a batch's (generation, trackIndex) can be named. */
  onActivation(listener: (activation: ProgramActivation) => void): Unsubscribe {
    return this.#activations.add(listener);
  }
  /** Worklet and transport counters, every 250 ms while running. */
  onStats(listener: (stats: EngineStats) => void): Unsubscribe {
    return this.#stats.add(listener);
  }

  /** Each program handed to the transport (the CPU meter maps instance names with it). */
  onLoad(listener: (program: Program) => void): Unsubscribe {
    return this.#programs.add(listener);
  }

  /** Receipts on, the state reaffirmed, every command and receipt reported (command-watch.ts). */
  watchCommands(watcher: CommandWatcher): CommandWatch {
    return this.#watch.watchCommands(watcher);
  }

  /** Ends the worker and detaches the node; the context belongs to whoever unlocked it. */
  dispose(): void {
    this.#watch.lost();
    this.#worker.terminate();
    this.#node.port.close();
    this.#node.disconnect();
    this.#failed = true;
  }

  #toWorker(message: MainToWorkerMessage): void {
    this.#log.note(message);
    this.#watch.sent(message);
    this.#worker.postMessage(message);
  }

  #fromWorker(message: WorkerToMainMessage): void {
    switch (message.type) {
      case "batch":
        this.#positions.emit(message.batch.position);
        this.#feeds.emit({
          batch: message.batch,
          sampleRate: this.#context.sampleRate,
          outputLatency: this.#context.outputLatency ?? this.#context.baseLatency,
        });
        return;
      case "program":
        this.#activations.emit(message.activation);
        return;
      case "ended":
        this.#ended.emit();
        return;
      case "stats":
        this.#stats.emit(message.stats);
        return;
      case "previewEnded":
        this.#previewEnded.emit();
        return;
      case "receipt":
        this.#watch.received(message);
        return;
    }
  }

  #watchWorklet(): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.error("Untzel worklet did not answer in", READY_TIMEOUT_MS, "ms");
        resolve(false);
      }, READY_TIMEOUT_MS);
      this.#node.port.onmessage = (event: MessageEvent<WorkletToMainMessage>) => {
        const message = event.data;
        if (message.type === "samplePackTaken") {
          this.#packs.onTaken();
          return;
        }
        if (message.type === "samplePack") {
          this.#packs.onTaken();
          if (message.atFrame === null) console.warn("Untzel: the worklet refused the samples of instrument", message.instrumentId);
          this.#samples.emit(message);
          return;
        }
        clearTimeout(timer);
        if (message.type === "ready") {
          resolve(true);
          return;
        }
        console.error("Untzel worklet load failed:", message.reason, message.detail);
        resolve(false);
      };
    });
  }
}
