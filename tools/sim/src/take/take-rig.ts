// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A take recorded live without a browser: the worker's TransportHost over the
// real Transport and PreviewTransport, its worklet clock reported on time every 25 ms
// tick, and the page's TakeRecorder reading the receipts. The take tests of the simulator
// and the take-render measurement record their takes with it.
import type { MainToWorkerMessage, WorkerToMainMessage } from "@untzel/audio/protocol";
import { TransportHost } from "@untzel/audio/worker";
import type { Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import type { ClockPort, EventSink, PreviewSink, ProgramActivation } from "@untzel/session";
import { TakeRecorder, type SentCommand, type Take } from "@untzel/take";
import { PreviewTransport, Transport } from "@untzel/transport";
import { simRegistry } from "../registry";

export const RIG_SAMPLE_RATE = 48_000;
const { registry, instruments } = simRegistry();
const NAMES = instruments.map((manifest) => manifest.name);

/** Text → Program with the simulator's registry; throws on a text that does not analyze. */
export function programOf(text: string): Program {
  const analyzed = analyze(text, registry);
  if (!analyzed.ok) throw new Error(`does not analyze: ${text}`);
  return analyzed.program;
}

/** What the live transport and audition delivered: activations, previews, the song's end. */
export class LiveLog implements EventSink, PreviewSink {
  readonly activations: number[] = [];
  readonly previewStarts: number[] = [];
  readonly previewEnds: number[] = [];
  readonly ends: number[] = [];
  deliver(): void {}
  programChanged(change: ProgramActivation): void {
    this.activations.push(change.atFrame);
  }
  tempoChanged(): void {}
  stopped(): void {}
  ended(atFrame: number): void {
    this.ends.push(atFrame);
  }
  previewStarted(_track: unknown, atFrame: number): void {
    this.previewStarts.push(atFrame);
  }
  previewScheduled(): void {}
  previewEnded(atFrame: number): void {
    this.previewEnds.push(atFrame);
  }
}

function messageOf(command: SentCommand): MainToWorkerMessage {
  switch (command.kind) {
    case "arm":
    case "disarm":
      return { type: "receipts", isOn: command.kind === "arm" };
    case "sounding":
      return { type: "load", program: programOf(command.recipe.source) };
    case "play":
      return command.startBar === null ? { type: "play", mode: command.mode } : { type: "play", mode: command.mode, startBar: command.startBar };
    case "mode":
      return { type: "setMode", mode: command.mode };
    case "stop":
      return { type: "stop" };
    case "range":
      return { type: "setPlayRange", change: command.change };
    case "background":
      return { type: "background", isHidden: command.isHidden };
    case "audition":
      return { type: "preview", program: command.program };
    case "auditionNote":
      return { type: "previewNote", program: command.program, midis: command.midis, seconds: command.seconds };
    case "auditionStop":
      return { type: "previewStop" };
  }
}

/** The worker with its 25 ms timer, the worklet's reports and the page's recorder. */
export class LiveRig {
  readonly log = new LiveLog();
  readonly recorder: TakeRecorder;
  ms = 1_000;
  #lastFrame = 0;
  readonly #worklet = { postMessage: () => undefined, onmessage: null as ((event: { readonly data: number }) => void) | null };
  readonly #host: TransportHost;
  constructor(includesAuditions = false) {
    this.recorder = new TakeRecorder({ sampleRate: RIG_SAMPLE_RATE, capSeconds: Number.POSITIVE_INFINITY, includesAuditions });
    const main = {
      postMessage: (message: WorkerToMainMessage) => {
        if (message.type !== "receipt") return;
        this.#lastFrame = message.frame ?? this.#lastFrame;
        if (this.recorder.received(message) === "mismatch") throw new Error("take rig: receipt mismatch");
      },
    };
    this.#host = new TransportHost(
      main,
      (clock: ClockPort) => new Transport({ clock, sink: this.log }),
      (clock: ClockPort) => new PreviewTransport({ clock, sink: this.log }),
      () => this.ms,
    );
    this.#host.receive({ type: "init", protocol: 2, port: this.#worklet as never, sampleRate: RIG_SAMPLE_RATE, instruments: NAMES });
    this.#report();
    this.send({ kind: "arm" });
  }
  /** The worklet's frame now. */
  get frame(): number {
    return Math.round((this.ms * RIG_SAMPLE_RATE) / 1_000);
  }
  /** The timer ticks every 25 ms up to `ms`, each tick after a report on time. */
  runTo(ms: number): void {
    while (this.ms + 25 <= ms) {
      this.ms += 25;
      this.#report();
      this.#host.tick();
    }
  }
  send(command: SentCommand): void {
    this.recorder.sent(command);
    this.#host.receive(messageOf(command));
  }
  load(text: string): void {
    this.send({ kind: "sounding", recipe: { source: text, solo: null, preview: null }, instruments: NAMES });
  }
  finish(title: string | null = "Night take"): Take {
    this.send({ kind: "disarm" });
    const take = this.recorder.finish("stop", this.#lastFrame, title);
    if (take === null) throw new Error("no take");
    return take;
  }
  #report(): void {
    this.#worklet.onmessage?.({ data: this.frame });
  }
}
