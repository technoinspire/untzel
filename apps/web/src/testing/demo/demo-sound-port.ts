// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The demo's sound port: the transport worker's own
// TransportHost, run in the page instead of a Worker, on the FrameClock. Nothing sounds:
// the worklet is a stand-in that reports the frame and drops every batch, and the WAV of
// the video comes from the take (pnpm sim --take). The command log and the command watch
// are the worklet port's, so the take records exactly what a live page sends.
import { CommandLog, CommandWatchSlot, Listeners, type CommandWatch, type CommandWatcher, type EngineSound, type SamplesLoaded, type ScheduledFeed } from "@untzel/audio/main";
import {
  PROTOCOL_VERSION,
  type EngineStats,
  type MainToWorkerMessage,
  type WorkerToMainMessage,
  type WorkerToWorkletMessage,
  type WorkletToWorkerMessage,
} from "@untzel/audio/protocol";
import { STATS_INTERVAL_MS, TICK_INTERVAL_MS, TransportHost, type PreviewFactory, type TransportFactory, type WorkletPort } from "@untzel/audio/worker";
import type { Program } from "@untzel/core";
import type { PlaybackMode, PlaybackPosition, PlayRangeChange, ProgramActivation, StartResult, Unsubscribe } from "@untzel/session";
import type { FrameClock } from "./frame-clock";

/** The worklet's side of the host's channel: it reports the frame and drops what it is sent. */
class SilentWorklet implements WorkletPort {
  onmessage: ((event: { readonly data: WorkletToWorkerMessage }) => void) | null = null;
  readonly #clock: FrameClock;
  constructor(clock: FrameClock) {
    this.#clock = clock;
  }

  /** A worklet reports currentFrame after each render; the demo reports it before the host reads it. */
  report(): void {
    this.onmessage?.({ data: this.#clock.nowFrame() });
  }

  postMessage(message: WorkerToWorkletMessage): void {
    if (message.type !== "statsRequest") return;
    const stats = { frame: this.#clock.nowFrame(), lateDrops: 0, queueDrops: 0, nanResets: 0, unknownMessages: 0, unknownTargets: 0, instances: [] };
    this.onmessage?.({ data: { type: "stats", stats } });
  }
}

export interface DemoSoundPortParts {
  readonly clock: FrameClock;
  readonly instruments: readonly string[];
  readonly createTransport: TransportFactory;
  readonly createPreview: PreviewFactory;
}

/** EngineSound over a TransportHost in the page. */
export class DemoSoundPort implements EngineSound {
  readonly #host: TransportHost;
  readonly #worklet: SilentWorklet;
  readonly #timers: ReturnType<typeof setInterval>[];
  readonly #positions = new Listeners<PlaybackPosition>();
  readonly #ended = new Listeners<void>();
  readonly #previewEnded = new Listeners<void>();
  readonly #feeds = new Listeners<ScheduledFeed>();
  readonly #stats = new Listeners<EngineStats>();
  readonly #programs = new Listeners<Program>();
  readonly #activations = new Listeners<ProgramActivation>();
  readonly #samples = new Listeners<SamplesLoaded>();
  readonly #log = new CommandLog();
  readonly #watch = new CommandWatchSlot({ send: (message) => this.#toHost(message), reaffirmation: () => this.#log.reaffirmation() });
  readonly #sampleRate: number;
  #isDisposed = false;
  constructor({ clock, instruments, createTransport, createPreview }: DemoSoundPortParts) {
    this.#sampleRate = clock.sampleRate;
    this.#worklet = new SilentWorklet(clock);
    // Like a worker's postMessage: each reply arrives later, one per message, in post order.
    const main = { postMessage: (message: WorkerToMainMessage) => queueMicrotask(() => this.#fromHost(message)) };
    this.#host = new TransportHost(main, createTransport, createPreview, () => clock.milliseconds());
    const port = this.#worklet as unknown as MessagePort;
    this.#host.receive({ type: "init", protocol: PROTOCOL_VERSION, port, sampleRate: clock.sampleRate, instruments: [...instruments] });
    this.#worklet.report();
    this.#timers = [
      setInterval(() => this.#tick(), TICK_INTERVAL_MS),
      setInterval(() => this.#host.requestStats(), STATS_INTERVAL_MS),
    ];
  }

  start(): Promise<StartResult> {
    return Promise.resolve(this.#isDisposed ? { ok: false, reason: "load-failed" } : { ok: true });
  }

  load(program: Program): void {
    this.#toHost({ type: "load", program });
    this.#programs.emit(program);
  }

  play(mode: PlaybackMode, startBar?: number): void {
    this.#toHost(startBar === undefined ? { type: "play", mode } : { type: "play", mode, startBar });
  }

  setMode(mode: PlaybackMode): void {
    this.#toHost({ type: "setMode", mode });
  }

  stop(): void {
    this.#toHost({ type: "stop" });
  }

  setPlayRange(change: PlayRangeChange): void {
    this.#toHost({ type: "setPlayRange", change });
  }

  setBackground(isHidden: boolean): void {
    this.#toHost({ type: "background", isHidden });
  }

  /** Nothing sounds in the demo. */
  setMasterGain(): void {}
  /** The worklet of the demo plays nothing: packs are for the sim's render of the take. */
  sendSamples(): void {}
  setVoiceBudget(): void {}
  onSamplesLoaded(listener: (loaded: SamplesLoaded) => void): Unsubscribe {
    return this.#samples.add(listener);
  }

  onPosition(listener: (position: PlaybackPosition) => void): Unsubscribe {
    return this.#positions.add(listener);
  }

  onEnded(listener: () => void): Unsubscribe {
    return this.#ended.add(listener);
  }

  preview(program: Program): void {
    this.#toHost({ type: "preview", program });
  }

  previewNote(program: Program, midis: readonly number[], seconds: number): void {
    this.#toHost({ type: "previewNote", program, midis, seconds });
  }

  stopPreview(): void {
    this.#toHost({ type: "previewStop" });
  }

  onPreviewEnded(listener: () => void): Unsubscribe {
    return this.#previewEnded.add(listener);
  }

  onScheduled(listener: (feed: ScheduledFeed) => void): Unsubscribe {
    return this.#feeds.add(listener);
  }

  onActivation(listener: (activation: ProgramActivation) => void): Unsubscribe {
    return this.#activations.add(listener);
  }

  onStats(listener: (stats: EngineStats) => void): Unsubscribe {
    return this.#stats.add(listener);
  }

  onLoad(listener: (program: Program) => void): Unsubscribe {
    return this.#programs.add(listener);
  }

  watchCommands(watcher: CommandWatcher): CommandWatch {
    return this.#watch.watchCommands(watcher);
  }

  dispose(): void {
    this.#watch.lost();
    for (const timer of this.#timers) clearInterval(timer);
    this.#isDisposed = true;
  }

  #tick(): void {
    this.#worklet.report();
    this.#host.tick();
  }

  #toHost(message: MainToWorkerMessage): void {
    if (this.#isDisposed) return;
    this.#log.note(message);
    this.#watch.sent(message);
    this.#worklet.report();
    this.#host.receive(message);
  }

  #fromHost(message: WorkerToMainMessage): void {
    switch (message.type) {
      case "batch":
        this.#positions.emit(message.batch.position);
        this.#feeds.emit({ batch: message.batch, sampleRate: this.#sampleRate, outputLatency: 0 });
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
}
