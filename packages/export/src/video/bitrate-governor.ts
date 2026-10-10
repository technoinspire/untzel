// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's own rate control (measured):
// Chrome's encoders treat a "constant" bitrate as a ceiling. On the dark stage they stop
// at about 3.7 Mbit/s whatever the target, 12 or 30 Mbit/s, so the tier would not reach
// the file. They do honour a per-frame quantizer, and a lower quantizer is a sharper
// picture. This picks each frame's quantizer from the bits the encoder handed back, so the
// light spends the tier's budget on picture quality. It never pads: on a picture so plain
// that the finest quantizer needs fewer bits, the file is simply smaller. Pure.
import type { VideoCodecName } from "../codecs/codecs";

export interface QuantizerScale {
  /** The finest quantizer the governor uses, near lossless. */
  readonly min: number;
  readonly max: number;
  readonly start: number;
  /** Quantizer steps that halve the bits: 6 in H.264. */
  readonly stepsPerHalving: number;
}

/**
 * WebCodecs' per-frame quantizer range of H.264, 0 to 51 (the only video codec).
 * The onboard's light settles at the floor at HD and at 4K (measured), so H.264 starts near
 * it and the first second is not spent climbing; Chrome's H.264 encoder on the Mac gives
 * the same bits at 0 and 1, so 1 is the floor.
 */
export const QUANTIZER_SCALES: Readonly<Record<VideoCodecName, QuantizerScale>> = {
  avc: { min: 1, max: 51, start: 4, stepsPerHalving: 6 },
};

/** Fraction of the measured error corrected per frame (tuned in bitrate-governor.test.ts). */
const GAIN = 0.1;
/** Frames of the recent average, half of the correction; the whole file so far is the other half. */
const RECENT_FRAMES = 15;

/**
 * How the light was encoded, for the quality check: a dark picture spends fewer
 * bits by nature, so below the target the measure of quality is the quantizer staying at
 * the finest the scale allows, not the rate.
 */
export interface RateControlReport {
  readonly lightFrames: number;
  /** Light frames handed to the encoder at the scale's finest quantizer. */
  readonly finestFrames: number;
  readonly finestQuantizer: number;
}
export interface BitrateGovernorOptions {
  /** The light's share of the file's budget, per frame. */
  readonly bitsPerFrame: number;
  readonly scale: QuantizerScale;
}

export class BitrateGovernor {
  readonly #target: number;
  readonly #scale: QuantizerScale;
  #quantizer: number;
  #recent: number | null = null;
  #spent = 0;
  #frames = 0;
  #handed = 0;
  #handedFinest = 0;

  constructor(options: BitrateGovernorOptions) {
    this.#target = Math.max(1, options.bitsPerFrame);
    this.#scale = options.scale;
    this.#quantizer = options.scale.start;
  }

  /** The quantizer for the next frame handed to the encoder. */
  get quantizer(): number {
    return Math.round(this.#quantizer);
  }

  /** The quantizer for the next light frame, counted for the report. */
  nextLightQuantizer(): number {
    const quantizer = this.quantizer;
    this.#handed += 1;
    if (quantizer === this.#scale.min) this.#handedFinest += 1;
    return quantizer;
  }
  report(): RateControlReport {
    return { lightFrames: this.#handed, finestFrames: this.#handedFinest, finestQuantizer: this.#scale.min };
  }
  /** One encoded light frame came back with `bits`; the next quantizer moves towards the budget. */
  record(bits: number): void {
    const spent = Math.max(1, bits);
    this.#frames += 1;
    this.#spent += spent;
    this.#recent = this.#recent === null ? spent : this.#recent + (spent - this.#recent) / RECENT_FRAMES;
    const recentError = Math.log2(this.#recent / this.#target);
    const overallError = Math.log2(this.#spent / (this.#frames * this.#target));
    const step = GAIN * this.#scale.stepsPerHalving * (recentError + overallError) / 2;
    this.#quantizer = Math.min(this.#scale.max, Math.max(this.#scale.min, this.#quantizer + step));
  }
}

/**
 * Bits per light frame so the whole file averages `bitrate`: the closing card is one still
 * picture and costs almost nothing, so its share goes to the light.
 */
export function lightBitsPerFrame(bitrate: number, fps: number, totalFrames: number, lightFrames: number): number {
  return (bitrate / fps) * (totalFrames / Math.max(1, lightFrames));
}
