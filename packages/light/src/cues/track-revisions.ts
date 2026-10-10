// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ActivatedTrack, ProgramActivation } from "@untzel/session";
// The activations of each generation. The transport re-sends an activation with
// the same generation at a part start, a mode change or a tempo change, to move the
// modulators: the new one is in effect from its atFrame, the one before for earlier events.

/** Activations kept to name late batches; older generations are dropped. */
export const KEPT_GENERATIONS = 8;
const REVISIONS_PER_GENERATION = 2;

export class TrackRevisions {
  readonly #generations = new Map<number, ProgramActivation[]>();

  /** True when the generation was already known (a re-sent activation). */
  add(activation: ProgramActivation): boolean {
    const revisions = this.#generations.get(activation.generation);
    if (revisions !== undefined) {
      revisions.push(activation);
      if (revisions.length > REVISIONS_PER_GENERATION) revisions.splice(0, revisions.length - REVISIONS_PER_GENERATION);
      return true;
    }
    this.#generations.set(activation.generation, [activation]);
    for (const generation of this.#generations.keys()) {
      if (generation <= activation.generation - KEPT_GENERATIONS) this.#generations.delete(generation);
    }
    return false;
  }

  has(generation: number): boolean {
    return this.#generations.has(generation);
  }

  /** The activation in effect at `frame`: the latest with atFrame ≤ frame, else the first. */
  activationAt(generation: number, frame: number): ProgramActivation | undefined {
    const revisions = this.#generations.get(generation);
    if (revisions === undefined) return undefined;
    let found = revisions[0];
    for (const revision of revisions) if (revision.atFrame <= frame) found = revision;
    return found;
  }

  trackAt(generation: number, trackIndex: number, frame: number): ActivatedTrack | undefined {
    return this.activationAt(generation, frame)?.tracks[trackIndex];
  }
}
