// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The recording, pure: what the page sent and what the worker answered arrive as
// arguments, frames included. No clock, no timer.
import type { SoundingRecipe } from "@untzel/session";
import { MAX_TAKE_ENTRIES, MAX_TAKE_TEXT_CHARS, TAKE_FORMAT, TAKE_VERSION, type Take, type TakeCommand, type TakeEntry } from "./take";
import { takeSpan } from "./take-span";
import { diffText } from "./text-diff";

export interface TakeRecorderOptions {
  readonly sampleRate: number;
  /** Cap in seconds, counted from t0. Infinity in the demo. */
  readonly capSeconds: number;
  /** The demo records the audition; a take does not. */
  readonly includesAuditions: boolean;
}

/** What the page sent to the transport, in send order. */
export type SentCommand =
  | { readonly kind: "arm" }
  | { readonly kind: "disarm" }
  | { readonly kind: "sounding"; readonly recipe: SoundingRecipe; readonly instruments: readonly string[] }
  | Exclude<TakeCommand, { kind: "sounding" }>;

/** The worker's receipt, as the protocol carries it. */
export interface CommandReceipt {
  readonly command: string;
  readonly frame: number | null;
  readonly horizon: number | null;
  readonly after: number | null;
}

export type ReceiptOutcome = "recorded" | "capped" | "full" | "disarmed" | "mismatch";

/** The protocol message each sent command is answered with. */
const RECEIPT_COMMAND: Readonly<Record<SentCommand["kind"], string>> = {
  arm: "receipts",
  disarm: "receipts",
  sounding: "load",
  play: "play",
  mode: "setMode",
  stop: "stop",
  range: "setPlayRange",
  background: "background",
  audition: "preview",
  auditionNote: "previewNote",
  auditionStop: "previewStop",
};

interface Queued {
  readonly kind: SentCommand["kind"];
  /** Null for the arm, the disarm and an audition the take leaves out. */
  readonly command: TakeCommand | null;
  readonly instruments: readonly string[];
  /** Text the entry adds to the take: the diff's insert and the preview's text. */
  readonly chars: number;
}

export class TakeRecorder {
  readonly #options: TakeRecorderOptions;
  #queue: Queued[] = [];
  /** The first unanswered command of #queue: shift() would be quadratic on a long queue. */
  #head = 0;
  readonly #entries: TakeEntry[] = [];
  readonly #instruments = new Set<string>();
  /** The source of the last sounding sent: the base of the next diff. */
  #sentText = "";
  #chars = 0;
  #armFrame: number | null = null;
  #t0: number | null = null;
  #lastFrame: number | null = null;
  /** The monotonic rules: the last frame and horizon of a paired receipt. */
  #seenFrame: number | null = null;
  #seenHorizon: number | null = null;
  /** Set once a receipt reached the cap or a limit: nothing more enters. */
  #closed: "capped" | "full" | null = null;

  constructor(options: TakeRecorderOptions) {
    this.#options = options;
  }

  /** FIFO, at send time; the text becomes a diff here. */
  sent(command: SentCommand): void {
    this.#queue.push(this.#queued(command));
  }

  received(receipt: CommandReceipt): ReceiptOutcome {
    const queued = this.#nextSent();
    if (queued === undefined || RECEIPT_COMMAND[queued.kind] !== receipt.command) return "mismatch";
    const { frame } = receipt;
    if (frame === null || !this.#isMonotonic(frame, receipt.horizon)) return "mismatch";
    if (this.#armFrame === null || queued.kind === "arm") return this.#arm(queued, frame);
    if (queued.kind === "disarm") {
      this.#lastFrame = frame;
      return "disarmed";
    }
    if (this.#closed !== null) return this.#closed;
    const cap = this.capFrame();
    if (cap !== null && frame >= cap) return (this.#closed = "capped");
    if (queued.command === null) {
      this.#lastFrame = frame;
      return "recorded";
    }
    if (this.#entries.length >= MAX_TAKE_ENTRIES || this.#chars + queued.chars > MAX_TAKE_TEXT_CHARS) {
      return (this.#closed = "full");
    }
    this.#record(queued, queued.command, frame, receipt);
    return "recorded";
  }

  /** t0: startFrame of the first play that started; null before. */
  firstSoundFrame(): number | null {
    return this.#t0;
  }

  /** t0 + round(capSeconds × sampleRate); null before t0. */
  capFrame(): number | null {
    if (this.#t0 === null) return null;
    return this.#t0 + Math.round(this.#options.capSeconds * this.#options.sampleRate);
  }

  /** clamp((frame − t0) / sampleRate, 0, capSeconds); 0 before t0. */
  elapsedSeconds(frame: number): number {
    if (this.#t0 === null) return 0;
    const seconds = (frame - this.#t0) / this.#options.sampleRate;
    return Math.min(Math.max(seconds, 0), this.#options.capSeconds);
  }

  /** Frame of the last accepted receipt (the end of an interrupted take); 0 before the arm. */
  lastFrame(): number {
    return this.#lastFrame ?? 0;
  }

  /** Closes the take at min(frame, capFrame()); null without t0 or under MIN_TAKE_SECONDS from t0. */
  finish(endedBy: Take["endedBy"], frame: number, title: string | null): Take | null {
    const cap = this.capFrame();
    if (this.#armFrame === null || cap === null) return null;
    const take: Take = {
      format: TAKE_FORMAT,
      version: TAKE_VERSION,
      sampleRate: this.#options.sampleRate,
      armFrame: this.#armFrame,
      endFrame: Math.min(frame, cap),
      endedBy,
      entries: [...this.#entries],
      instruments: [...this.#instruments],
      title,
    };
    return takeSpan(take) === null ? null : take;
  }

  #queued(command: SentCommand): Queued {
    switch (command.kind) {
      case "arm":
      case "disarm":
        return { kind: command.kind, command: null, instruments: [], chars: 0 };
      case "sounding": {
        const { source, solo, preview } = command.recipe;
        const diff = diffText(this.#sentText, source);
        this.#sentText = source;
        const chars = diff.insert.length + (preview?.text.length ?? 0);
        return { kind: "sounding", command: { kind: "sounding", source: diff, solo, preview }, instruments: command.instruments, chars };
      }
      case "audition":
      case "auditionNote":
      case "auditionStop":
        return { kind: command.kind, command: this.#options.includesAuditions ? command : null, instruments: [], chars: 0 };
      default:
        return { kind: command.kind, command, instruments: [], chars: 0 };
    }
  }

  #nextSent(): Queued | undefined {
    const queued = this.#queue[this.#head];
    if (queued === undefined) return undefined;
    this.#head += 1;
    if (this.#head === this.#queue.length) {
      this.#queue = [];
      this.#head = 0;
    }
    return queued;
  }

  /**
   * The three rules, and only them: the frame never descends; the arm frame is the
   * lowest; a non-null horizon never descends from the previous non-null one unless a
   * receipt with a null horizon came between (a stop, or commands with the music stopped).
   */
  #isMonotonic(frame: number, horizon: number | null): boolean {
    if (this.#seenFrame !== null && frame < this.#seenFrame) return false;
    if (this.#armFrame !== null && frame < this.#armFrame) return false;
    if (horizon !== null && this.#seenHorizon !== null && horizon < this.#seenHorizon) return false;
    this.#seenFrame = frame;
    this.#seenHorizon = horizon;
    return true;
  }

  /** The first receipt is the arm's, and only the first. */
  #arm(queued: Queued, frame: number): ReceiptOutcome {
    if (queued.kind !== "arm" || this.#armFrame !== null) return "mismatch";
    this.#armFrame = frame;
    this.#lastFrame = frame;
    return "recorded";
  }

  #record(queued: Queued, command: TakeCommand, frame: number, receipt: CommandReceipt): void {
    // A play that found the music stopped and scheduled something started it.
    const startFrame = command.kind === "play" && receipt.horizon === null && receipt.after !== null ? receipt.after : null;
    const entry: TakeEntry = startFrame === null ? { command, frame, horizon: receipt.horizon } : { command, frame, horizon: receipt.horizon, startFrame };
    this.#entries.push(entry);
    this.#t0 ??= startFrame;
    this.#chars += queued.chars;
    for (const name of queued.instruments) this.#instruments.add(name);
    this.#lastFrame = frame;
  }
}
