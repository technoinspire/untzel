// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { MainToWorkerMessage, WorkerToMainMessage } from "../protocol";

/** The protocol's receipt; @untzel/take's CommandReceipt has the same shape (audio never imports take). */
export type ReceiptMessage = Extract<WorkerToMainMessage, { type: "receipt" }>;

export interface CommandWatcher {
  /** At send time, in send order (the arm and the reaffirmation included). */
  sent(message: MainToWorkerMessage): void;
  /** Each receipt, in the same order. */
  received(receipt: ReceiptMessage): void;
  /** The engine is gone (worker error, dispose, context swap): no more receipts. */
  lost(): void;
}

export interface CommandWatch {
  /** Sends receipts off; resolves with the disarm receipt, or null after 1 000 ms. */
  stop(): Promise<ReceiptMessage | null>;
}

/** The one member of EngineSound the take needs (TakeControls is given only this). */
export interface CommandWatchPort {
  /** Turns receipts on, reaffirms the state, reports every command and receipt. */
  watchCommands(watcher: CommandWatcher): CommandWatch;
}

/** How long stop() waits for the disarm receipt, and a new watch for an old disarm to drain. */
export const COMMAND_WATCH_TIMEOUT_MS = 1_000;

/** What the slot needs from its sound port. */
export interface CommandWatchSlotParts {
  /** Posts to the worker through the port, so the watcher and the log see the message. */
  readonly send: (message: MainToWorkerMessage) => void;
  /** The state to say again right after the arm (CommandLog.reaffirmation). */
  readonly reaffirmation: () => readonly MainToWorkerMessage[];
}

interface Stopping {
  readonly promise: Promise<ReceiptMessage | null>;
  readonly resolve: (receipt: ReceiptMessage | null) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

type SlotState =
  | { readonly kind: "idle" }
  /** `isArmed`: the arm's own receipt arrived, so the next receipts receipt is the disarm. */
  | { readonly kind: "watching"; readonly watcher: CommandWatcher; isArmed: boolean; stopping: Stopping | null }
  /** A stop timed out: receipts are dropped until `receiptsToDrop` receipts receipts arrived. */
  | { readonly kind: "draining"; receiptsToDrop: number; next: { readonly watcher: CommandWatcher; readonly timer: ReturnType<typeof setTimeout> } | null };

/**
 * One command watch at a time over a sound port. States idle, watching and
 * draining: after a stop that timed out, the late disarm must never pair with the next arm
 * (same command name), so receipts are dropped until it arrives, and a new watch waits.
 */
export class CommandWatchSlot implements CommandWatchPort {
  readonly #parts: CommandWatchSlotParts;
  #state: SlotState = { kind: "idle" };

  constructor(parts: CommandWatchSlotParts) {
    this.#parts = parts;
  }

  watchCommands(watcher: CommandWatcher): CommandWatch {
    const state = this.#state;
    if (state.kind === "watching" || (state.kind === "draining" && state.next !== null)) {
      throw new Error("a command watch is already active");
    }
    if (state.kind === "draining") {
      const timer = setTimeout(() => this.#drainTimedOut(watcher), COMMAND_WATCH_TIMEOUT_MS);
      state.next = { watcher, timer };
    } else {
      this.#arm(watcher);
    }
    let stopped: Promise<ReceiptMessage | null> | null = null;
    return { stop: () => (stopped ??= this.#stop(watcher)) };
  }

  /** Every message on its way to the worker, before it is posted. */
  sent(message: MainToWorkerMessage): void {
    const state = this.#state;
    if (state.kind === "watching" && state.stopping === null) state.watcher.sent(message);
  }

  /** Every receipt from the worker. */
  received(receipt: ReceiptMessage): void {
    const state = this.#state;
    if (state.kind === "watching") {
      state.watcher.received(receipt);
      if (receipt.command !== "receipts") return;
      if (!state.isArmed) state.isArmed = true;
      else if (state.stopping !== null) this.#stopped(state.stopping, receipt);
      return;
    }
    if (state.kind !== "draining" || receipt.command !== "receipts") return;
    state.receiptsToDrop -= 1;
    if (state.receiptsToDrop > 0) return;
    const next = state.next;
    this.#state = { kind: "idle" };
    if (next === null) return;
    clearTimeout(next.timer);
    this.#arm(next.watcher);
  }

  /** The worker failed, the port was disposed or the context swapped: no more receipts. */
  lost(): void {
    const state = this.#state;
    this.#state = { kind: "idle" };
    if (state.kind === "watching") {
      if (state.stopping !== null) {
        clearTimeout(state.stopping.timer);
        state.stopping.resolve(null);
      }
      state.watcher.lost();
    } else if (state.kind === "draining" && state.next !== null) {
      clearTimeout(state.next.timer);
      state.next.watcher.lost();
    }
  }

  #arm(watcher: CommandWatcher): void {
    this.#state = { kind: "watching", watcher, isArmed: false, stopping: null };
    this.#parts.send({ type: "receipts", isOn: true });
    for (const message of this.#parts.reaffirmation()) this.#parts.send(message);
  }

  #stop(watcher: CommandWatcher): Promise<ReceiptMessage | null> {
    const state = this.#state;
    if (state.kind === "draining" && state.next?.watcher === watcher) {
      // Never armed: nothing to turn off.
      clearTimeout(state.next.timer);
      state.next = null;
      return Promise.resolve(null);
    }
    if (state.kind !== "watching" || state.watcher !== watcher) return Promise.resolve(null);
    let resolve: (receipt: ReceiptMessage | null) => void = () => undefined;
    const promise = new Promise<ReceiptMessage | null>((settle) => (resolve = settle));
    const timer = setTimeout(() => this.#stopTimedOut(), COMMAND_WATCH_TIMEOUT_MS);
    // The disarm is the watcher's last sent message; nothing after it has a receipt.
    this.#parts.send({ type: "receipts", isOn: false });
    state.stopping = { promise, resolve, timer };
    return promise;
  }

  #stopped(stopping: Stopping, receipt: ReceiptMessage): void {
    clearTimeout(stopping.timer);
    this.#state = { kind: "idle" };
    stopping.resolve(receipt);
  }

  #stopTimedOut(): void {
    const state = this.#state;
    if (state.kind !== "watching" || state.stopping === null) return;
    // The arm's receipt may still be on its way too, ahead of the disarm's.
    this.#state = { kind: "draining", receiptsToDrop: state.isArmed ? 1 : 2, next: null };
    state.stopping.resolve(null);
  }

  #drainTimedOut(watcher: CommandWatcher): void {
    const state = this.#state;
    if (state.kind !== "draining" || state.next?.watcher !== watcher) return;
    this.#state = { kind: "idle" };
    watcher.lost();
  }
}
