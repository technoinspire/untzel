// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The CPU protection of the engine. Every few quanta the host asks for
// a step: the load is estimated as the meter does (fixed + Σ active voices × cost per
// voice × fraction per unit). Above 100% the quietest tracks (lowest gain; a tie takes the
// last in the text) lose one voice at a time until the estimate is at 90%, never below
// one voice; under 70% one voice comes back per step, in the reverse order. Without a
// budget (no calibration yet) nothing is limited. step() allocates nothing: it runs in
// the audio thread.

import type { VoiceBudget } from "../protocol";

/** The largest pool a manifest may ask for; a quota this high is no quota. */
export const MAX_POOL_VOICES = 32;
export const REDUCE_ABOVE = 1;
export const REDUCE_TO = 0.9;
export const RESTORE_BELOW = 0.7;
/** No quota: the pool size of the instrument. */
export const UNLIMITED = 0;

export interface GovernedTrack {
  readonly slot: number;
  readonly instrumentId: number;
  readonly gain: number;
}

/** The two calls into the engine a step needs. */
export interface VoiceControl {
  activeVoices(slot: number): number;
  limitVoices(slot: number, maxVoices: number): void;
}

export class VoiceGovernor {
  #budget: VoiceBudget | null = null;
  #slots = new Int32Array(0);
  #costs = new Float64Array(0);
  /** Track positions sorted for reduction: lowest gain first, a tie last-in-text first. */
  #order = new Int32Array(0);
  /** Current quota per track position; UNLIMITED when none. */
  #quotas = new Int32Array(0);

  setBudget(budget: VoiceBudget | null): void {
    this.#budget = budget;
  }

  /** Message handler: the tracks of the program just activated. Quotas of kept slots stay. */
  configure(tracks: readonly GovernedTrack[]): void {
    const previous = new Map<number, number>();
    this.#slots.forEach((slot, index) => previous.set(slot, this.#quotas[index] ?? UNLIMITED));
    const costs = this.#budget?.costs ?? [];
    this.#slots = Int32Array.from(tracks, (track) => track.slot);
    this.#costs = Float64Array.from(tracks, (track) => costs[track.instrumentId] ?? 0);
    this.#quotas = Int32Array.from(tracks, (track) => previous.get(track.slot) ?? UNLIMITED);
    const positions = tracks.map((_, index) => index);
    positions.sort((a, b) => (tracks[a]?.gain ?? 0) - (tracks[b]?.gain ?? 0) || b - a);
    this.#order = Int32Array.from(positions);
  }

  /** Audio thread: one estimate and, when needed, quota changes. */
  step(control: VoiceControl): void {
    const budget = this.#budget;
    if (budget === null || budget.fractionPerUnit <= 0) return;
    let units = 0;
    for (let index = 0; index < this.#slots.length; index += 1) units += this.#voices(control, index) * (this.#costs[index] ?? 0);
    const fraction = budget.fixedFraction + units * budget.fractionPerUnit;
    if (fraction > REDUCE_ABOVE) this.#reduce(control, budget, units);
    else if (fraction < RESTORE_BELOW) this.#restoreOne(control);
  }

  /** Visible for tests: the quota of the track at `position`. */
  quotaAt(position: number): number {
    return this.#quotas[position] ?? UNLIMITED;
  }

  /** Voices that count now: the active ones, capped by the quota. */
  #voices(control: VoiceControl, index: number): number {
    const active = control.activeVoices(this.#slots[index] ?? 0);
    const quota = this.#quotas[index] ?? UNLIMITED;
    return quota === UNLIMITED ? active : Math.min(active, quota);
  }

  #reduce(control: VoiceControl, budget: VoiceBudget, startUnits: number): void {
    let units = startUnits;
    let reduced = true;
    while (reduced && budget.fixedFraction + units * budget.fractionPerUnit > REDUCE_TO) {
      reduced = false;
      for (let rank = 0; rank < this.#order.length; rank += 1) {
        const index = this.#order[rank] ?? 0;
        const voices = this.#voices(control, index);
        if (voices <= 1) continue;
        this.#quotas[index] = voices - 1;
        control.limitVoices(this.#slots[index] ?? 0, voices - 1);
        units -= this.#costs[index] ?? 0;
        reduced = true;
        if (budget.fixedFraction + units * budget.fractionPerUnit <= REDUCE_TO) return;
      }
    }
  }

  #restoreOne(control: VoiceControl): void {
    for (let rank = this.#order.length - 1; rank >= 0; rank -= 1) {
      const index = this.#order[rank] ?? 0;
      const quota = this.#quotas[index] ?? UNLIMITED;
      if (quota === UNLIMITED) continue;
      const next = quota + 1 >= MAX_POOL_VOICES ? UNLIMITED : quota + 1;
      this.#quotas[index] = next;
      control.limitVoices(this.#slots[index] ?? 0, next);
      return;
    }
  }
}
