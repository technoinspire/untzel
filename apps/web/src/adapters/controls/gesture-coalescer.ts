// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** Continuous gestures (sliders, tone drag) become one edit per pause this long. */
export const GESTURE_COALESCE_MS = 60;

/** Keeps the last value of each continuous gesture and applies it after a pause. */
export class GestureCoalescer {
  readonly #pending = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #applies = new Map<string, () => void>();
  readonly #delayMs: number;

  constructor(delayMs = GESTURE_COALESCE_MS) {
    this.#delayMs = delayMs;
  }

  schedule(key: string, apply: () => void): void {
    const pending = this.#pending.get(key);
    if (pending !== undefined) clearTimeout(pending);
    this.#applies.set(key, apply);
    this.#pending.set(
      key,
      setTimeout(() => {
        this.#pending.delete(key);
        this.#applies.delete(key);
        apply();
      }, this.#delayMs),
    );
  }

  /** Applies every pending gesture now (a drag ended: its last value belongs to its step). */
  flushAll(): void {
    const pending = [...this.#applies];
    this.cancelAll();
    for (const apply of pending.map(([, run]) => run)) apply();
  }

  cancelAll(): void {
    for (const timer of this.#pending.values()) clearTimeout(timer);
    this.#pending.clear();
    this.#applies.clear();
  }
}
