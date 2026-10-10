// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Mandatory flash limiter (WCAG 2.3.1). Works on numbers
// only, so it is tested without a GPU: per frame it receives the composed screen's mean
// relative luminance, split into a steady base and the transient peaks the cues add,
// and returns the gain applied to the transient part.

export interface FrameLuminance {
  /** Seconds, monotonic. */
  readonly time: number;
  /** Mean relative luminance of everything that is not a cue peak (fog, idle). 0..1. */
  readonly base: number;
  /** Mean relative luminance the cue peaks add on top of base. 0..1. */
  readonly transient: number;
  /** The transient light is saturated red (R / (R + G + B) ≥ 0.8). */
  readonly isSaturatedRed: boolean;
}

export interface FlashLimiterOptions {
  /** WCAG: no more than three flashes in any one second. */
  readonly maxFlashesPerSecond: number;
  /** A change of this much relative luminance counts as a flash (WCAG: 10 %). */
  readonly threshold: number;
  /** Reduced motion (the page's effective choice): no peaks, only slow variation. The initial value. */
  readonly reducedMotion: boolean;
}

export const DEFAULT_LIMITER: FlashLimiterOptions = {
  maxFlashesPerSecond: 3,
  threshold: 0.1,
  reducedMotion: false,
};

/** Kept below the threshold with margin when a peak is not allowed. */
const SAFE_FRACTION = 0.9;
/** Reduced motion: transient never above this fraction of the threshold… */
const REDUCED_CEILING = 0.5;
/** …and changes at most this much relative luminance per second. */
const REDUCED_SLEW_PER_S = 0.1;
const WINDOW_S = 1;

/**
 * A flash is a rise of at least `threshold` from the last trough followed by a fall of
 * at least `threshold` from the peak (WCAG's pair of opposing changes). Rises are
 * counted when they start; once the quota of the last second is used, the next rise
 * is held under the threshold. Saturated red never gets a rise above the threshold.
 */
export class FlashLimiter {
  readonly #options: FlashLimiterOptions;
  #flashTimes: number[] = [];
  #inFlash = false;
  #peak = 0;
  #trough = 0;
  /** transient × gain of the last frame, in both modes: where a switch of mode starts from. */
  #lastOutput = 0;
  #lastTime: number | null = null;
  #reducedMotion: boolean;
  constructor(options: Partial<FlashLimiterOptions> = {}) {
    this.#options = { ...DEFAULT_LIMITER, ...options };
    this.#reducedMotion = this.#options.reducedMotion;
  }
  /**
   * The menu's Reduced motion turned while the light plays. The three
   * flashes per second and the red ceiling hold in both modes; Off only drops the extra
   * reduction. To reduced: the slew starts from what is on screen, so nothing jumps. To
   * full: the next rise is measured from what was on screen, and the flashes of the last
   * second still count.
   */
  setReducedMotion(isReduced: boolean): void {
    if (isReduced === this.#reducedMotion) return;
    this.#reducedMotion = isReduced;
    if (isReduced) return;
    this.#inFlash = false;
    this.#peak = this.#lastOutput;
    this.#trough = this.#lastOutput;
  }
  /** Gain 0..1 for the transient part of this frame. */
  gain(frame: FrameLuminance): number {
    const dt = this.#lastTime === null ? 0 : Math.max(0, frame.time - this.#lastTime);
    this.#lastTime = frame.time;
    const transient = Math.max(0, frame.transient);
    if (this.#reducedMotion) return this.#reduced(transient, dt);
    const gain = this.#full(transient, frame);
    this.#lastOutput = transient * gain;
    return gain;
  }
  #full(transient: number, frame: FrameLuminance): number {
    const { threshold } = this.#options;

    if (this.#inFlash) {
      this.#peak = Math.max(this.#peak, transient);
      if (this.#peak - transient >= threshold) {
        this.#inFlash = false;
        this.#trough = transient;
      }
      return 1;
    }
    if (transient - this.#trough < threshold) {
      this.#trough = Math.min(this.#trough, transient);
      return 1;
    }
    this.#forget(frame.time);
    if (!frame.isSaturatedRed && this.#flashTimes.length < this.#options.maxFlashesPerSecond) {
      this.#flashTimes.push(frame.time);
      this.#inFlash = true;
      this.#peak = transient;
      return 1;
    }
    return (this.#trough + threshold * SAFE_FRACTION) / transient;
  }

  /** Flash count inside the last second, for diagnostics. */
  recentFlashes(now: number): number {
    this.#forget(now);
    return this.#flashTimes.length;
  }

  /** Rises are slewed; a fall is instant but never larger than the ceiling. */
  #reduced(transient: number, dt: number): number {
    if (transient === 0) {
      this.#lastOutput = 0;
      return 1;
    }
    const ceiling = this.#options.threshold * REDUCED_CEILING;
    const target = Math.min(transient, ceiling);
    const step = REDUCED_SLEW_PER_S * dt;
    const output = this.#lastOutput + Math.max(-step, Math.min(step, target - this.#lastOutput));
    this.#lastOutput = output;
    return Math.min(1, output / transient);
  }

  #forget(now: number): void {
    this.#flashTimes = this.#flashTimes.filter((time) => now - time < WINDOW_S);
  }
}

/** sRGB channel (0..255) to linear light. */
export function linearChannel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB color. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG 2.x saturated red test on the light's color. */
export function isSaturatedRed(r: number, g: number, b: number): boolean {
  const sum = r + g + b;
  return sum > 0 && r / sum >= 0.8;
}

export function contrastRatio(a: number, b: number): number {
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}
