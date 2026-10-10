// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { LightTimeline } from "../ports";
// The music's clock for the light: continuous motion and the feedback grid run on
// bars and beats from the scheduled positions, never on the wall clock, so the screen and
// the export see the same instant at the same audio time.
//   beat = (bar + (t − timeline.audioTime) / secondsPerBar) × 4

const FALLBACK: LightTimeline = { audioTime: 0, bar: 0, secondsPerBar: 2, section: null };

export class MusicalClock {
  #timelines: LightTimeline[] = [];

  add(timeline: LightTimeline): void {
    if (!(timeline.secondsPerBar > 0)) return;
    const last = this.#timelines.at(-1);
    if (last !== undefined && last.audioTime === timeline.audioTime && last.bar === timeline.bar && last.section === timeline.section) return;
    this.#timelines.push(timeline);
    this.#timelines.sort((a, b) => a.audioTime - b.audioTime);
    if (this.#timelines.length > 256) this.#timelines = this.#timelines.slice(-128);
  }

  clear(): void {
    this.#timelines = [];
  }

  /** The latest bar boundary at or before t (the first one before any). */
  timelineAt(t: number): LightTimeline {
    let found = this.#timelines[0] ?? FALLBACK;
    for (const timeline of this.#timelines) {
      if (timeline.audioTime > t) break;
      found = timeline;
    }
    return found;
  }

  /** Bars since play, fractional. */
  barAt(t: number): number {
    const timeline = this.timelineAt(t);
    return timeline.bar + (t - timeline.audioTime) / timeline.secondsPerBar;
  }

  beatAt(t: number): number {
    return this.barAt(t) * 4;
  }

  /** Audio time of a (fractional) bar, on the tempo of the boundary before it. */
  timeOfBar(bar: number): number {
    let found = this.#timelines[0] ?? FALLBACK;
    for (const timeline of this.#timelines) {
      if (timeline.bar > bar) break;
      found = timeline;
    }
    return found.audioTime + (bar - found.bar) * found.secondsPerBar;
  }

  sectionAt(t: number): string | null {
    return this.timelineAt(t).section;
  }
}
