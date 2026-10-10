// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { FlashLimiter, FrameLuminance } from "./flash-limiter";
import { trailDecay } from "../composer/feedback-schedule";
import { outputGain } from "./post-light";
// The flash limiter on a fixed 120 Hz clock of audio time, so the stage at any
// frame rate and the export at 30 fps limit the same light the same way. It measures an
// estimate of the FINAL image, after the trail and the bloom: (1 + bloom) × (scene + trail),
// the trail an upper bound (summed, where the renderer takes the max).

export const LIMITER_RATE_HZ = 120;
/** A hidden tab longer than this jumps the clock to the last second. */
const LONGEST_CATCH_UP_S = 1;

export interface LimitedLight {
  /** The limiter's gain on the transient light. */
  readonly gain: number;
  /** The uniform factor for the final image (post-light outputGain). */
  readonly output: number;
}

export class LimiterClock {
  readonly #limiter: FlashLimiter;
  #bloom: number;
  #hasTrail: boolean;
  #step: number | null = null;
  #trail = { base: 0, transient: 0 };
  #last: LimitedLight = { gain: 1, output: 1 };

  constructor(limiter: FlashLimiter, bloom: number, hasTrail: boolean) {
    this.#limiter = limiter;
    this.#bloom = bloom;
    this.#hasTrail = hasTrail;
  }

  /**
   * The menu's Reduced motion: the limiter's mode and the final image's
   * bloom and trail. Without a trail the trail's estimate is gone at once.
   */
  setReducedMotion(isReduced: boolean, bloom: number, hasTrail: boolean): void {
    this.#limiter.setReducedMotion(isReduced);
    this.#bloom = bloom;
    this.#hasTrail = hasTrail;
    if (!hasTrail) this.#trail = { base: 0, transient: 0 };
  }
  /** Runs every pending step k / 120 ≤ t and returns the last step's gain. */
  advanceTo(t: number, luminanceAt: (time: number) => FrameLuminance): LimitedLight {
    const target = Math.floor(t * LIMITER_RATE_HZ);
    if (this.#step === null || target - this.#step > LONGEST_CATCH_UP_S * LIMITER_RATE_HZ) this.#step = target - LONGEST_CATCH_UP_S * LIMITER_RATE_HZ;
    while (this.#step < target) {
      this.#step += 1;
      this.#last = this.#measure(luminanceAt(this.#step / LIMITER_RATE_HZ));
    }
    return this.#last;
  }

  #measure(scene: FrameLuminance): LimitedLight {
    const lift = 1 + this.#bloom;
    // The image is max(scene, trail) per pixel; scene + trail bounds its mean from above.
    const base = Math.min(1, lift * (scene.base + this.#trail.base));
    const transient = Math.min(1, lift * (scene.transient + this.#trail.transient));
    const decay = this.#hasTrail ? trailDecay(1 / LIMITER_RATE_HZ) : 0;
    this.#trail = { base: decay * Math.max(scene.base, this.#trail.base), transient: decay * Math.max(scene.transient, this.#trail.transient) };
    const gain = this.#limiter.gain({ ...scene, base, transient });
    return { gain, output: outputGain(base, transient, gain) };
  }
}
