// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The take's watcher of the engine's commands: each message on its way to the
// transport worker becomes the take's command, and each receipt goes to the recorder. The
// sounding recipe is read at send time, when the session already holds what it loads. No
// rule of its own: the recorder pairs and judges, the caller decides what an outcome means.
import type { CommandWatcher, ReceiptMessage } from "@untzel/audio/main";
import type { MainToWorkerMessage } from "@untzel/audio/protocol";
import type { Session, SoundingRecipe } from "@untzel/session";
import type { ReceiptOutcome, SentCommand, TakeRecorder } from "@untzel/take";

export interface TakeCaptureListener {
  /** The recorder's outcome for one receipt. */
  received(outcome: ReceiptOutcome, receipt: ReceiptMessage): void;
  /** The engine is gone: no more receipts. */
  lost(): void;
}

export class TakeCapture implements CommandWatcher {
  readonly #recorder: Pick<TakeRecorder, "sent" | "received">;
  readonly #session: Pick<Session, "soundingRecipe">;
  readonly #listener: TakeCaptureListener;

  constructor(recorder: Pick<TakeRecorder, "sent" | "received">, session: Pick<Session, "soundingRecipe">, listener: TakeCaptureListener) {
    this.#recorder = recorder;
    this.#session = session;
    this.#listener = listener;
  }

  sent(message: MainToWorkerMessage): void {
    const command = sentCommand(message, () => this.#session.soundingRecipe());
    if (command !== null) this.#recorder.sent(command);
  }

  received(receipt: ReceiptMessage): void {
    this.#listener.received(this.#recorder.received(receipt), receipt);
  }

  lost(): void {
    this.#listener.lost();
  }
}

/** The take's command for one message; null for a message the worker gives no receipt (init). */
export function sentCommand(message: MainToWorkerMessage, recipe: () => SoundingRecipe | null): SentCommand | null {
  switch (message.type) {
    case "load":
      // A load always follows a program, so the recipe is there; an empty one keeps the pairing.
      return { kind: "sounding", recipe: recipe() ?? { source: "", solo: null, preview: null }, instruments: message.program.tracks.map((track) => track.instrument) };
    case "play":
      return { kind: "play", mode: message.mode, startBar: message.startBar ?? null };
    case "setMode":
      return { kind: "mode", mode: message.mode };
    case "stop":
      return { kind: "stop" };
    case "setPlayRange":
      return { kind: "range", change: message.change };
    case "background":
      return { kind: "background", isHidden: message.isHidden };
    case "preview":
      return { kind: "audition", program: message.program };
    case "previewNote":
      return { kind: "auditionNote", program: message.program, midis: message.midis, seconds: message.seconds };
    case "previewStop":
      return { kind: "auditionStop" };
    case "receipts":
      return { kind: message.isOn ? "arm" : "disarm" };
    case "init":
      return null;
  }
}
