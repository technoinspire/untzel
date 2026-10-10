// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  PROTOCOL_VERSION,
  type MainToWorkerMessage,
  type WorkerToMainMessage,
  type WorkerToWorkletMessage,
  type WorkletToWorkerMessage,
} from "../protocol";
import type { Program } from "@untzel/core";
import type { BeatGrid, ClockPort, EventSink, PlaybackMode, PlayRangeChange, PreviewSink, TransportStats } from "@untzel/session";
import { HeldClock } from "./held-clock";
import { WorkletClock } from "./worklet-clock";
import { WorkletEventSink, type MessageTarget } from "./worklet-event-sink";

/**
 * What the worker needs from a transport. Structural on purpose: audio does not import
 * @untzel/transport; the composition passes `(clock, sink) => new Transport({ clock, sink })`.
 */
export interface TransportControl {
  setProgram(next: Program): void;
  play(mode?: PlaybackMode, options?: { readonly startBar?: number }): unknown;
  setMode(mode: PlaybackMode): unknown;
  stop(): void;
  setPlayRange(change: PlayRangeChange): void;
  /** The page is hidden: schedule further ahead (BACKGROUND_LOOKAHEAD_SECONDS). */
  setBackground(isHidden: boolean): void;
  tick(): void;
  /** Everything before this frame was delivered; null when stopped or with a play pending. */
  scheduledUntil(): number | null;
  stats(): TransportStats;
  /** While playing: where the music's beats fall, for the audition. */
  beatGrid(): BeatGrid | null;
}

export type TransportFactory = (clock: ClockPort, sink: EventSink) => TransportControl;

/** What the worker needs from the audition (@untzel/transport's PreviewTransport). */
export interface PreviewControl {
  start(program: Program, grid: BeatGrid | null): boolean;
  note(program: Program, midis: readonly number[], seconds: number): boolean;
  stop(): void;
  tick(): void;
}

export type PreviewFactory = (clock: ClockPort, sink: PreviewSink) => PreviewControl;

/** The worker end of the worker <-> worklet channel. */
export interface WorkletPort extends MessageTarget<WorkerToWorkletMessage> {
  onmessage: ((event: { readonly data: WorkletToWorkerMessage }) => void) | null;
}

export const TICK_INTERVAL_MS = 25;
export const STATS_INTERVAL_MS = 250;

interface Running {
  readonly transport: TransportControl;
  readonly preview: PreviewControl;
  /** What the worklet reports to; the transport and the preview read it through `held`. */
  readonly clock: WorkletClock;
  readonly held: HeldClock;
  readonly worklet: WorkletPort;
}
type Command = Exclude<MainToWorkerMessage, { readonly type: "init" }>;

/** Owns the transport inside the worker; the only place that schedules. */
export class TransportHost {
  readonly #main: MessageTarget<WorkerToMainMessage>;
  readonly #createTransport: TransportFactory;
  readonly #createPreview: PreviewFactory;
  readonly #now: () => number;
  #running: Running | null = null;
  #unknownMessages = 0;
  /** While on, every handled message is answered with a receipt. */
  #isReceiptsOn = false;

  constructor(
    main: MessageTarget<WorkerToMainMessage>,
    createTransport: TransportFactory,
    createPreview: PreviewFactory,
    now: () => number,
  ) {
    this.#main = main;
    this.#createTransport = createTransport;
    this.#createPreview = createPreview;
    this.#now = now;
  }

  /**
   * Handles one message from the main thread with the clock held: every frame the message
   * produces comes from one reading, and the receipt reports it.
   */
  receive(message: MainToWorkerMessage): void {
    if (message.type === "init") {
      this.#init(message);
      return;
    }
    const running = this.#running;
    if (running === null) {
      this.#unknownMessages += 1;
      return;
    }
    const frame = running.held.hold();
    try {
      const wasOn = this.#isReceiptsOn;
      const horizon = running.transport.scheduledUntil();
      if (!this.#handle(running, message)) return;
      const after = running.transport.scheduledUntil();
      // The receipts message answers its own: turning on, and the last one turning off.
      if (wasOn || this.#isReceiptsOn) this.#main.postMessage({ type: "receipt", command: message.type, frame, horizon, after }, []);
    } finally {
      running.held.release();
    }
  }
  /** Returns false for a message of an unknown type. */
  #handle(running: Running, message: Command): boolean {
    const { transport, preview } = running;
    switch (message.type) {
      case "load":
        transport.setProgram(message.program);
        return true;
      case "play":
        preview.stop();
        transport.play(message.mode, message.startBar === undefined ? undefined : { startBar: message.startBar });
        return true;
      case "setMode":
        transport.setMode(message.mode);
        return true;
      case "stop":
        preview.stop();
        transport.stop();
        return true;
      case "background":
        transport.setBackground(message.isHidden);
        return true;
      case "setPlayRange":
        transport.setPlayRange(message.change);
        return true;
      case "preview":
        if (!preview.start(message.program, transport.beatGrid())) this.#main.postMessage({ type: "previewEnded" }, []);
        return true;
      case "previewStop":
        preview.stop();
        return true;
      case "previewNote":
        preview.note(message.program, message.midis, message.seconds);
        return true;
      case "receipts":
        this.#isReceiptsOn = message.isOn;
        return true;
      default:
        this.#unknownMessages += 1;
        return false;
    }
  }
  /** Called every TICK_INTERVAL_MS by the worker timer. */
  tick(): void {
    const running = this.#running;
    if (running === null) return;
    running.held.hold();
    try {
      running.transport.tick();
      running.preview.tick();
    } finally {
      running.held.release();
    }
  }

  /** Called every STATS_INTERVAL_MS: the worklet answers from its message handler. */
  requestStats(): void {
    this.#running?.worklet.postMessage({ type: "statsRequest" }, []);
  }

  #init(message: Extract<MainToWorkerMessage, { readonly type: "init" }>): void {
    if (this.#running !== null || message.protocol !== PROTOCOL_VERSION) {
      this.#unknownMessages += 1;
      return;
    }
    const worklet = message.port as unknown as WorkletPort;
    const clock = new WorkletClock(message.sampleRate, this.#now);
    // A new worklet, a new clock: the floor of the held clock never crosses contexts.
    const held = new HeldClock(clock);
    const sink = new WorkletEventSink(worklet, this.#main, message.instruments);
    const transport = this.#createTransport(held, sink);
    const preview = this.#createPreview(held, sink);
    this.#running = { transport, preview, clock, held, worklet };
    worklet.onmessage = (event) => this.#receiveFromWorklet(event.data);
  }

  #receiveFromWorklet(message: WorkletToWorkerMessage): void {
    const running = this.#running;
    if (running === null) return;
    if (typeof message === "number") {
      running.clock.report(message);
      return;
    }
    if (message.type === "stats") {
      const stats = message.stats;
      this.#main.postMessage(
        {
          type: "stats",
          stats: {
            ...stats,
            unknownMessages: stats.unknownMessages + this.#unknownMessages,
            ...running.transport.stats(),
          },
        },
        [],
      );
      return;
    }
    this.#unknownMessages += 1;
  }
}
