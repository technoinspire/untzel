// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { AudibilityChange, LightProgram } from "../ports";
// Which program and which tracks are lit at an audio time. A program takes
// effect at its own audio time, never when it is received. A new generation with the same
// hashes and tracks (every `| mute`, the loop mode's Drop) is only a change of audibility:
// the scenes stay where they are. A track that goes silent or comes back ramps over a beat.

const KEPT_PROGRAMS = 8;

interface Entry {
  readonly program: LightProgram;
  readonly changes: AudibilityChange[];
}

export interface LitTrack {
  readonly track: string;
  /** 0..1: the audibility ramp times the cross-fade. */
  readonly gain: number;
}

export interface ProgramAt {
  readonly program: LightProgram;
  /** The program that is leaving during a cross-fade, with its gain. */
  readonly leaving: { readonly program: LightProgram; readonly gain: number } | null;
}

export class ProgramTimeline {
  #entries: Entry[] = [];

  setProgram(program: LightProgram): void {
    const last = this.#entries.at(-1);
    if (last !== undefined && isSameStage(last.program, program)) {
      last.changes.push({ audioTime: program.audioTime, audible: program.audible });
      return;
    }
    this.#entries.push({ program, changes: [] });
    this.#entries.sort((a, b) => a.program.audioTime - b.program.audioTime);
    if (this.#entries.length > KEPT_PROGRAMS) this.#entries = this.#entries.slice(-KEPT_PROGRAMS);
  }

  setAudibility(change: AudibilityChange): void {
    const entry = this.#entryAt(change.audioTime) ?? this.#entries.at(-1);
    entry?.changes.push(change);
    entry?.changes.sort((a, b) => a.audioTime - b.audioTime);
  }

  clear(): void {
    this.#entries = [];
  }

  /** The program in effect at t, and the one leaving within `crossFade` seconds of the switch. */
  programAt(t: number, crossFade: number): ProgramAt | null {
    const index = this.#indexAt(t);
    const entry = this.#entries[index];
    if (entry === undefined) return null;
    const previous = this.#entries[index - 1];
    const since = t - entry.program.audioTime;
    const leaving = previous !== undefined && since < crossFade ? { program: previous.program, gain: 1 - since / crossFade } : null;
    return { program: entry.program, leaving };
  }

  /** The program's tracks lit at t, each with its ramp over `ramp` seconds. */
  litTracks(program: LightProgram, t: number, ramp: number): readonly LitTrack[] {
    const entry = this.#entries.find((candidate) => candidate.program === program);
    const changes = entry?.changes.filter((change) => change.audioTime <= t) ?? [];
    return program.scenes.flatMap((scene) => {
      let isLit = program.audible.has(scene.track);
      let since = Number.POSITIVE_INFINITY;
      for (const change of changes) {
        const next = change.audible.has(scene.track);
        if (next !== isLit) since = change.audioTime;
        isLit = next;
      }
      const progress = Math.min(1, (t - since) / ramp);
      const gain = Number.isFinite(since) ? (isLit ? progress : 1 - progress) : isLit ? 1 : 0;
      return gain > 0 ? [{ track: scene.track, gain }] : [];
    });
  }

  #indexAt(t: number): number {
    let found = -1;
    this.#entries.forEach((entry, index) => {
      if (entry.program.audioTime <= t) found = index;
    });
    return found === -1 && this.#entries.length > 0 ? 0 : found;
  }

  #entryAt(t: number): Entry | undefined {
    return this.#entries[this.#indexAt(t)];
  }
}

function isSameStage(a: LightProgram, b: LightProgram): boolean {
  if (a.lightSourceHash !== b.lightSourceHash || a.stagePlanHash !== b.stagePlanHash || a.scenes.length !== b.scenes.length) return false;
  return a.scenes.every((scene, index) => scene.track === b.scenes[index]?.track && scene.instrument === b.scenes[index]?.instrument);
}
