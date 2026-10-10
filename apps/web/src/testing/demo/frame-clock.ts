// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The demo's output clock: the page's performance.now(),
// which the recorder fakes and advances one video frame at a time, read as 48 kHz frames.
// No latency: what is scheduled for a frame is "heard" at that frame.
import type { EngineClock } from "@untzel/audio/main";

/** The demo's take never changes rate: 48 000 frames per second, 48 per millisecond. */
export const DEMO_SAMPLE_RATE = 48_000;

const FRAMES_PER_MS = DEMO_SAMPLE_RATE / 1000;

export class FrameClock implements EngineClock {
  readonly sampleRate = DEMO_SAMPLE_RATE;
  readonly #now: () => number;
  /** `now` is a millisecond clock: the page's performance.now, faked by the recorder. */
  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
  }

  /** The millisecond clock the transport host extrapolates the worklet's reports with. */
  milliseconds(): number {
    return this.#now();
  }

  nowFrame(): number {
    return Math.round(this.#now() * FRAMES_PER_MS);
  }

  seconds(): number {
    return this.nowFrame() / DEMO_SAMPLE_RATE;
  }

  heardTime(): number {
    return this.seconds();
  }
}
