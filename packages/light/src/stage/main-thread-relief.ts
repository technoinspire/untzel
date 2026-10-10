// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The stage's relief of the main thread. The scene shares the thread
// with the controls; when the page misses frames, the light gives way first, so the
// interface never loses half its frame rate to the scene. Measured by the interval between
// animation frames, the one signal that counts the whole page and not only the scene:
//   level 1: the tracks over the frame's budget draw nothing instead of their light version;
//   level 2: also, the frame shows the limiter's last 120 Hz step instead of composing its own
//   instant (at most 1/120 s earlier), the trail is off, as under reduced motion, and the
//   stage draws at half its resolution with the trail and bloom at a quarter.
// The tracks admitted in full by the budget always draw: the readable state does not change.
// Down only, one level at a time, as the frame budget; a new play starts at level 0.

/** An animation frame this late missed at least one refresh of a 60 Hz screen. */
export const SLOW_INTERVAL_MS = 25;
/** Frames looked at, and how many of them must be slow to step down. */
export const RELIEF_WINDOW = 30;
export const SLOW_FRAMES_IN_WINDOW = 20;
export const DEEPEST_RELIEF = 2;

export type ReliefLevel = 0 | 1 | 2;

export class MainThreadRelief {
  #slow: boolean[] = [];
  #level: ReliefLevel = 0;

  get level(): ReliefLevel {
    return this.#level;
  }

  /** Feeds the interval since the animation frame before; returns the level for this one. */
  record(intervalMs: number): ReliefLevel {
    this.#slow.push(intervalMs > SLOW_INTERVAL_MS);
    if (this.#slow.length > RELIEF_WINDOW) this.#slow.shift();
    const slow = this.#slow.filter(Boolean).length;
    if (slow >= SLOW_FRAMES_IN_WINDOW && this.#level < DEEPEST_RELIEF) {
      this.#level = this.#level === 0 ? 1 : 2;
      this.#slow = [];
    }
    return this.#level;
  }

  reset(): void {
    this.#slow = [];
    this.#level = 0;
  }
}
