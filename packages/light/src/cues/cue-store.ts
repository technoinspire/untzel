// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { LightCue } from "../ports";
// The cues of every track, in audio-time order. Nothing is dropped for arriving
// late: a cue that reaches a slow device after its own time shows from the middle of its
// life, as in the export. Cues older than KEEP_SECONDS are pruned.

export const KEEP_SECONDS = 20;

export class CueStore {
  readonly #tracks = new Map<string, LightCue[]>();
  #revision = 0;
  #latestPrunedBar = Number.NEGATIVE_INFINITY;

  /** Changes whenever a cue is added: the budget's cache key. */
  get revision(): number {
    return this.#revision;
  }

  add(cues: readonly LightCue[]): void {
    for (const cue of cues) {
      const list = this.#tracks.get(cue.track) ?? [];
      let index = list.length;
      while (index > 0 && (list[index - 1]?.audioTime ?? 0) > cue.audioTime) index -= 1;
      list.splice(index, 0, cue);
      this.#tracks.set(cue.track, list);
    }
    if (cues.length > 0) this.#revision += 1;
  }

  /** Cues of a track that started in [from, to], oldest first. */
  between(track: string, from: number, to: number): readonly LightCue[] {
    const list = this.#tracks.get(track);
    if (list === undefined) return [];
    // The list is in audio-time order: find the first cue at or after `from`, then read on.
    let low = 0;
    let high = list.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((list[middle]?.audioTime ?? 0) < from) low = middle + 1;
      else high = middle;
    }
    const found: LightCue[] = [];
    for (let index = low; index < list.length; index += 1) {
      const cue = list[index];
      if (cue === undefined || cue.audioTime > to) break;
      found.push(cue);
    }
    return found;
  }

  /** Cues of a track in bar `bar`. */
  inBar(track: string, bar: number): readonly LightCue[] {
    return (this.#tracks.get(track) ?? []).filter((cue) => cue.bar === bar);
  }

  /** The latest bar a prune removed a cue from: a bar after it still has all its cues. */
  get latestPrunedBar(): number {
    return this.#latestPrunedBar;
  }

  prune(before: number): void {
    for (const [track, list] of this.#tracks) {
      for (const cue of list) {
        if (cue.audioTime >= before - KEEP_SECONDS) break;
        this.#latestPrunedBar = Math.max(this.#latestPrunedBar, cue.bar);
      }
      const kept = list.filter((cue) => cue.audioTime >= before - KEEP_SECONDS);
      if (kept.length === 0) this.#tracks.delete(track);
      else this.#tracks.set(track, kept);
    }
  }

  clear(): void {
    this.#tracks.clear();
    this.#revision += 1;
    this.#latestPrunedBar = Number.NEGATIVE_INFINITY;
  }
}
