// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// When the toast hides: after its duration, but never while a pointer or the focus is on
// it; leaving starts the count again. Pure over an injected timer.
export interface ToastClock {
  set(run: () => void, ms: number): () => void;
}
export class ToastTimer {
  readonly #clock: ToastClock;
  readonly #onExpire: () => void;
  #cancel: (() => void) | null = null;
  #durationMs = 0;
  #isHeld = false;
  constructor(clock: ToastClock, onExpire: () => void) {
    this.#clock = clock;
    this.#onExpire = onExpire;
  }
  start(durationMs: number): void {
    this.#durationMs = durationMs;
    this.#arm();
  }
  hold(isHeld: boolean): void {
    this.#isHeld = isHeld;
    this.#arm();
  }
  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
    this.#isHeld = false;
  }
  #arm(): void {
    this.#cancel?.();
    this.#cancel = this.#isHeld ? null : this.#clock.set(() => this.#onExpire(), this.#durationMs);
  }
}
