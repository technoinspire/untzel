// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneDescription } from "@untzel/scene";
import type { CueStore } from "../cues/cue-store";
import { admitNewcomers, admittedBy, planBar, type BarPlan, type Version } from "./scene-budget";

// The bar's budget is a pure function of the cues of the bar and the bar before,
// but the composer asks for it at every instant it composes: the frame, the trail grid and
// the limiter's 120 Hz clock, about four times a frame. With 64 tracks the plan costs a
// quarter of the scene's main-thread time, so it is kept until a cue arrives,
// a prune reaches the bars it read, or the program or the audible tracks change. The answer
// is the one allocateBar gives: only the work is shared.

interface Entry {
  readonly program: object;
  readonly revision: number;
  readonly plan: BarPlan;
  readonly byAdmitted: Map<number, ReadonlyMap<string, Version>>;
}

/** Bars kept: this bar and the bar before, which the exposure slide also reads. */
const KEPT_BARS = 2;

export class BarBudgetCache {
  readonly #entries = new Map<string, Entry>();

  /** allocateBar(audible, store, bar, secondsPerBar, now), with the plan shared between calls. */
  allocate(program: object, audible: readonly SceneDescription[], store: CueStore, bar: number, secondsPerBar: number, now: number): ReadonlyMap<string, Version> {
    const key = `${bar}|${secondsPerBar}|${audible.map((scene) => scene.track).join("\u0000")}`;
    const entry = this.#valid(this.#entries.get(key), program, store, bar) ?? this.#plan(key, program, audible, store, bar, secondsPerBar);
    const count = admittedBy(entry.plan, now);
    const cached = entry.byAdmitted.get(count);
    if (cached !== undefined) return cached;
    const versions = admitNewcomers(entry.plan, count);
    entry.byAdmitted.set(count, versions);
    return versions;
  }

  clear(): void {
    this.#entries.clear();
  }

  #valid(entry: Entry | undefined, program: object, store: CueStore, bar: number): Entry | undefined {
    if (entry === undefined || entry.program !== program || entry.revision !== store.revision) return undefined;
    // The plan read the bars bar − 1 and bar: a prune that removed a cue of either changes it.
    return store.latestPrunedBar < bar - 1 ? entry : undefined;
  }

  #plan(key: string, program: object, audible: readonly SceneDescription[], store: CueStore, bar: number, secondsPerBar: number): Entry {
    const entry: Entry = { program, revision: store.revision, plan: planBar(audible, store, bar, secondsPerBar), byAdmitted: new Map() };
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    while (this.#entries.size > KEPT_BARS * 2) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    return entry;
  }
}
