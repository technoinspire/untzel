// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { flowNoise } from "./flow-noise";
import type { MusicalClock } from "../stage/musical-clock";
// The feedback trail on a fixed grid of audio time (THIRD_PARTY.md: the
// Butterchurn technique, warp and fade the previous frame, no MilkDrop preset). The buffer
// steps every 1/96 of a bar, the cues' tick, whatever the frame rate:
//   F(n)       = max(S(t_n), d · warp_n(F(n − 1)))
//   display(t) = max(S(t),   d · warp(F(m)))       m: the last step before t
//   d          = 2^(−step / 0.06 s): half-life 60 ms, under 1/255 in 0.5 s
//   warp       = zoom 1 − 0.15 · step about the core, turn 0.05 · step · flowNoise(beat/8, 0.5, 0, stagePlanHash)
// Max, never a sum: the trail adds no light, it only lengthens a figure's fall. Pure.

export const GRID_STEPS_PER_BAR = 96;
export const TRAIL_HALF_LIFE_S = 0.06;
const ZOOM_PER_SECOND = 0.15;
const TURN_PER_SECOND = 0.05;
/** The export rolls the trail this long before its first frame (residue 9e-6). */
export const EXPORT_PRE_ROLL_S = 1;
/** After a pause with more pending, the stage clears and rolls only this long (residue 0.3 %). */
export const STAGE_PRE_ROLL_S = 0.5;

export interface TrailStep {
  /** t_n, audio seconds. */
  readonly time: number;
  /** Seconds since the step before. */
  readonly seconds: number;
  readonly decay: number;
  /** < 1: the trail contracts towards the core. */
  readonly zoom: number;
  /** Radians. */
  readonly turn: number;
}

export function trailDecay(seconds: number): number {
  return 2 ** (-seconds / TRAIL_HALF_LIFE_S);
}

export function trailStep(time: number, seconds: number, beat: number, stagePlanHash: number): TrailStep {
  return {
    time,
    seconds,
    decay: trailDecay(seconds),
    zoom: 1 - ZOOM_PER_SECOND * seconds,
    turn: TURN_PER_SECOND * seconds * flowNoise(beat / 8, 0.5, 0, stagePlanHash),
  };
}

/** The grid steps t_n with from < t_n ≤ to, in order. */
export function trailSteps(clock: MusicalClock, from: number, to: number, stagePlanHash: number): readonly TrailStep[] {
  if (!(to > from)) return [];
  const first = Math.floor(clock.barAt(from) * GRID_STEPS_PER_BAR) + 1;
  const last = Math.floor(clock.barAt(to) * GRID_STEPS_PER_BAR + 1e-9);
  const steps: TrailStep[] = [];
  for (let n = first; n <= last; n += 1) {
    const time = clock.timeOfBar(n / GRID_STEPS_PER_BAR);
    const seconds = time - clock.timeOfBar((n - 1) / GRID_STEPS_PER_BAR);
    steps.push(trailStep(time, seconds, (n / GRID_STEPS_PER_BAR) * 4, stagePlanHash));
  }
  return steps;
}

/** The part of a step between the last grid step and t: display(t) = max(S(t), d · warp(F(m))). */
export function partialStep(last: TrailStep, t: number): TrailStep {
  const seconds = Math.max(0, t - last.time);
  const share = last.seconds > 0 ? seconds / last.seconds : 0;
  return { time: t, seconds, decay: trailDecay(seconds), zoom: 1 - ZOOM_PER_SECOND * seconds, turn: last.turn * share };
}
