// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { FRAME_REPORT_INTERVAL_QUANTA } from "../protocol";
import type { ClockPort } from "@untzel/session";

const RENDER_QUANTUM = 128;
/** A report older than four report intervals is not extrapolated further. */
const MAX_EXTRAPOLATION_FRAMES = FRAME_REPORT_INTERVAL_QUANTA * RENDER_QUANTUM * 4;

/**
 * nowFrame = lastFrame + (now() - receivedAt) x sampleRate / 1000, capped at
 * lastFrame + 8 x 128 x 4 so a stale report is not extrapolated.
 */
export class WorkletClock implements ClockPort {
  readonly sampleRate: number;
  readonly #now: () => number;
  #lastFrame: number | null = null;
  #receivedAt = 0;

  /** `now` is a millisecond clock (the worker passes performance.now). */
  constructor(sampleRate: number, now: () => number) {
    this.sampleRate = sampleRate;
    this.#now = now;
  }

  /** Called with each bare-number frame report from the worklet. */
  report(frame: number): void {
    this.#lastFrame = frame;
    this.#receivedAt = this.#now();
  }

  nowFrame(): number | null {
    if (this.#lastFrame === null) return null;
    const elapsed = ((this.#now() - this.#receivedAt) * this.sampleRate) / 1000;
    return this.#lastFrame + Math.min(Math.max(0, Math.round(elapsed)), MAX_EXTRAPOLATION_FRAMES);
  }

  staleness(): number {
    return this.#lastFrame === null ? Number.POSITIVE_INFINITY : this.#now() - this.#receivedAt;
  }
}
