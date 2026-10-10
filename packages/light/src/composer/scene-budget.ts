// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneFamily } from "@untzel/core";
import type { SceneDescription } from "@untzel/scene";
import type { CueStore } from "../cues/cue-store";
import { lifeOf, primitivesPerPulse } from "../families/family-table";
import type { LightCue } from "../ports";
import { MAX_PRIMITIVES } from "./scene-primitive";
// The frame's budget, decided once per bar from the cues of the bar before (all
// of them have arrived when the bar starts, in any batch size): at most 192 primitives and
// 4 full layers per family; above that a track of lower priority draws its light version.
// A track silent in the bar before is admitted at its first cue of this bar if it fits,
// in a fixed order (audio time, weight × velocity, look seed), never in arrival order.
// Pure: the same cues give the same allocation on the screen and in the export.

export const FULL_LAYERS_PER_FAMILY = 4;
const NEWCOMER_RESERVE = 1;
const DEFAULT_COST = 4;

export const FAMILY_WEIGHT: Readonly<Record<SceneFamily, number>> = {
  shockwave: 1.4,
  floor: 1.3,
  ribbon: 1.2,
  halo: 1.1,
  bars: 1,
  burst: 1,
  sparks: 0.95,
  ripple: 0.9,
  mark: 0.85,
  fog: 0.8,
  sweep: 0.75,
};

export interface Version {
  readonly isFull: boolean;
  /** 0..1, the track's energy in the bar before. */
  readonly energy: number;
}

/** Σ velocity × min(duration + ½ release, bar) / bar, held to 1. */
export function energyOf(cues: readonly LightCue[], secondsPerBar: number): number {
  const sum = cues.reduce((total, cue) => total + cue.velocity * Math.min(cue.duration + cue.release / 2, secondsPerBar), 0);
  return Math.min(1, sum / secondsPerBar);
}

/** The most pulses of the track alive at once in those cues, times what one pulse draws. */
export function costOf(description: SceneDescription, cues: readonly LightCue[]): number {
  if (cues.length === 0) return DEFAULT_COST;
  let most = 0;
  for (const cue of cues) {
    const alive = cues.filter((other) => other.audioTime <= cue.audioTime && other.audioTime + lifeOf(description, other) > cue.audioTime).length;
    most = Math.max(most, alive);
  }
  return most * primitivesPerPulse(description);
}

interface Ranked {
  readonly description: SceneDescription;
  readonly priority: number;
  readonly energy: number;
  readonly cost: number;
}

/** The bar's versions: the base from the bar before, then newcomers admitted up to `now`. */
export function allocateBar(audible: readonly SceneDescription[], store: CueStore, bar: number, secondsPerBar: number, now: number): ReadonlyMap<string, Version> {
  const plan = planBar(audible, store, bar, secondsPerBar);
  return admitNewcomers(plan, admittedBy(plan, now));
}

/**
 * The part of a bar's allocation that does not depend on `now`: the tracks heard in the bar
 * before, admitted by priority, and the newcomers in the order they would be admitted.
 */
export interface BarPlan {
  readonly versions: ReadonlyMap<string, Version>;
  readonly families: ReadonlyMap<SceneFamily, number>;
  readonly used: number;
  readonly newcomers: readonly { readonly description: SceneDescription; readonly cue: LightCue }[];
}

export function planBar(audible: readonly SceneDescription[], store: CueStore, bar: number, secondsPerBar: number): BarPlan {
  const ranked: Ranked[] = [];
  const newcomers: SceneDescription[] = [];
  for (const description of audible) {
    const previous = store.inBar(description.track, bar - 1);
    if (previous.length === 0) newcomers.push(description);
    else ranked.push({ description, energy: energyOf(previous, secondsPerBar), cost: costOf(description, previous), priority: 0 });
  }
  const prioritized = ranked.map((entry) => ({ ...entry, priority: FAMILY_WEIGHT[entry.description.family] * entry.energy }));
  prioritized.sort((a, b) => b.priority - a.priority || a.description.lookSeed - b.description.lookSeed);
  const admission = new Admission(new Map(), new Map(), newcomers.length * NEWCOMER_RESERVE);
  for (const entry of prioritized) admission.admit(entry.description, entry.cost, entry.energy);
  return { versions: admission.versions, families: admission.families, used: admission.used, newcomers: newcomerOrder(newcomers, store, bar) };
}

/** How many of the plan's newcomers have had their first cue by `now`. */
export function admittedBy(plan: BarPlan, now: number): number {
  let count = 0;
  while (count < plan.newcomers.length && (plan.newcomers[count]?.cue.audioTime ?? Number.POSITIVE_INFINITY) <= now) count += 1;
  return count;
}

/** The plan with its first `count` newcomers admitted, each at two pulses, in order. */
export function admitNewcomers(plan: BarPlan, count: number): ReadonlyMap<string, Version> {
  const admission = new Admission(new Map(plan.versions), new Map(plan.families), plan.used);
  for (const { description, cue } of plan.newcomers.slice(0, count)) {
    admission.used -= NEWCOMER_RESERVE;
    admission.admit(description, 2 * primitivesPerPulse(description), cue.velocity);
  }
  return admission.versions;
}

class Admission {
  readonly versions: Map<string, Version>;
  readonly families: Map<SceneFamily, number>;
  used: number;

  constructor(versions: Map<string, Version>, families: Map<SceneFamily, number>, used: number) {
    this.versions = versions;
    this.families = families;
    this.used = used;
  }

  admit(description: SceneDescription, cost: number, energy: number): void {
    const count = this.families.get(description.family) ?? 0;
    const fits = count < FULL_LAYERS_PER_FAMILY && this.used + cost <= MAX_PRIMITIVES;
    if (fits) this.families.set(description.family, count + 1);
    this.used += fits ? cost : 1;
    this.versions.set(description.track, { isFull: fits, energy });
  }
}

function newcomerOrder(newcomers: readonly SceneDescription[], store: CueStore, bar: number): readonly { readonly description: SceneDescription; readonly cue: LightCue }[] {
  const firsts = newcomers.flatMap((description) => {
    const cue = store.inBar(description.track, bar)[0];
    return cue === undefined ? [] : [{ description, cue }];
  });
  const weight = (entry: (typeof firsts)[number]): number => FAMILY_WEIGHT[entry.description.family] * entry.cue.velocity;
  return firsts.sort((a, b) => a.cue.audioTime - b.cue.audioTime || weight(b) - weight(a) || a.description.lookSeed - b.description.lookSeed);
}
