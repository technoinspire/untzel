// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ClockPort } from "@untzel/session";
import type { WorkletClock } from "./worklet-clock";

/**
 * The worker clock held for one message (or one tick), never going back.
 * WorkletClock extrapolates from performance.now() on every call and re-anchors on each
 * report, so it can return a smaller frame than before (a 2 048-frame audio callback, or
 * postMessage jitter). The transport reads nowFrame() on its own inside a command; holding
 * makes every one of those reads the same frame, and the floor keeps time from descending.
 * One instance per worklet: a floor never crosses audio contexts.
 */
export class HeldClock implements ClockPort {
  #held: number | null = null;
  /** The highest frame handed out: the transport never sees time go back. */
  #floor: number | null = null;

  constructor(readonly inner: WorkletClock) {}

  get sampleRate(): number {
    return this.inner.sampleRate;
  }

  /** Every nowFrame() inside one message (or one tick) returns this frame. */
  hold(): number | null {
    return (this.#held = this.#monotonic());
  }

  release(): void {
    this.#held = null;
  }

  nowFrame(): number | null {
    return this.#held ?? this.#monotonic();
  }

  /** The inner clock's: the stale-clock detection does not change. */
  staleness(): number {
    return this.inner.staleness();
  }

  #monotonic(): number | null {
    const now = this.inner.nowFrame();
    if (now === null) return null;
    this.#floor = Math.max(now, this.#floor ?? now);
    return this.#floor;
  }
}
