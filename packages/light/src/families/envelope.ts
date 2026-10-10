// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The level of a pulse over its life: attack, sustain for the note's duration,
// release. Under reduced motion every family shares one shape instead, a trapezoid that
// starts from a visible state and never grows or travels.

/** Reduced motion: every family rises and falls over this. */
export const REDUCED_RAMP_S = 0.35;

export function envelope(age: number, attack: number, hold: number, release: number): number {
  if (age < 0) return 0;
  const rise = Math.max(attack, 0.001);
  if (age < rise) return age / rise;
  if (age < rise + hold) return 1;
  return Math.min(1, Math.max(0, 1 - (age - rise - hold) / Math.max(release, 0.01)));
}

/** 0.35 s up, hold until `life`, 0.35 s down. */
export function trapezoid(age: number, life: number): number {
  const up = Math.min(1, Math.max(0, age / REDUCED_RAMP_S));
  const down = Math.min(1, Math.max(0, 1 - (age - life) / REDUCED_RAMP_S));
  return Math.min(up, down);
}
