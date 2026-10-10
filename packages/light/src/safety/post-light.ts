// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The passes after the scene, in one fixed order in every renderer: scene (SDF
// figures and area light) → feedback trail (max) → dual-filter bloom → hue-preserving tone
// map → the limiter's gain → (export) the brand mark. The light fallback only changes
// resolution, never the look. Pure numbers; the renderers read them.

export const BLOOM_INTENSITY = 0.35;
/** Reduced motion: half the bloom and no trail. */
export const REDUCED_BLOOM_INTENSITY = 0.18;
export const BLOOM_LEVELS = 5;
/**
 * A figure's crisp stroke over its own intensity: the rings, needles and ribbons read as
 * sharp light in front of the area light instead of melting into it. The limiter's
 * estimate (luminance.ts) and the 2D level use the same factor.
 */
export const FIGURE_GAIN = 1.5;

export interface PostSettings {
  readonly bloom: number;
  readonly hasTrail: boolean;
  /** 0.5 normally, 0.25 in the light fallback: the trail and bloom chain's resolution. */
  readonly bufferScale: number;
  /** Applied to the final image only, never to the trail. */
  readonly outputGain: number;
}

export function postSettings(isReduced: boolean, isLightFallback: boolean, outputGain: number): PostSettings {
  return {
    bloom: isReduced ? REDUCED_BLOOM_INTENSITY : BLOOM_INTENSITY,
    hasTrail: !isReduced,
    bufferScale: isLightFallback ? 0.25 : 0.5,
    outputGain,
  };
}

/**
 * The uniform factor that gives the final image the luminance the limiter aimed at: it
 * decides gain g on the transient light T over the base light B.
 */
export function outputGain(base: number, transient: number, gain: number): number {
  if (gain >= 1 || base + transient <= 0) return 1;
  return (base + gain * transient) / (base + transient);
}
