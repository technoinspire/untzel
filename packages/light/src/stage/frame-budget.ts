// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Frame budget: above 14 ms for 30 frames in a row, first
// the particle count drops, then the internal resolution, one step at a time.

export interface FrameQuality {
  readonly particleScale: number;
  readonly resolutionScale: number;
}

export const FRAME_BUDGET_MS = 14;
export const SLOW_FRAMES_TO_DEGRADE = 30;

const STEPS: readonly FrameQuality[] = [
  { particleScale: 1, resolutionScale: 1 },
  { particleScale: 0.5, resolutionScale: 1 },
  { particleScale: 0.25, resolutionScale: 1 },
  { particleScale: 0.25, resolutionScale: 0.75 },
  { particleScale: 0.25, resolutionScale: 0.5 },
  { particleScale: 0.25, resolutionScale: 0.35 },
];

export class FrameBudget {
  #step = 0;
  #slowFrames = 0;

  get quality(): FrameQuality {
    return STEPS[this.#step] ?? STEPS[0]!;
  }

  /** Feeds one frame's duration; returns the quality for the next frame. */
  record(frameMs: number): FrameQuality {
    if (frameMs > FRAME_BUDGET_MS) this.#slowFrames += 1;
    else this.#slowFrames = 0;
    if (this.#slowFrames >= SLOW_FRAMES_TO_DEGRADE && this.#step < STEPS.length - 1) {
      this.#step += 1;
      this.#slowFrames = 0;
    }
    return this.quality;
  }
}
