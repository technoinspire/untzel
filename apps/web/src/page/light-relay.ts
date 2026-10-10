// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Holds the light stage, which loads in the background, and the clock it reads, which
// becomes the AudioContext's once the gesture unlocks it. Types only: initial JS. The
// program in effect (and the audibility changes since) reach a stage that attaches late.
// It also hands the Export sheet a still of the scene (null before the stage is ready).
import type { KeepOut } from "@untzel/scene";
import type { AudibilityChange, HeardClock, LightCue, LightPort, LightProgram, LightTimeline, SceneStills, StageMode } from "@untzel/light";

const wallClock: HeardClock = { heardTime: () => performance.now() / 1000 };

export class LightRelay implements LightPort, SceneStills {
  #stage: (LightPort & SceneStills) | null = null;
  #mode: StageMode = "idle";
  #source: HeardClock = wallClock;
  #program: LightProgram | null = null;
  #changes: AudibilityChange[] = [];
  /** The stage reads this one; it follows whichever clock is current. */
  readonly clock: HeardClock = { heardTime: () => this.#source.heardTime() };

  attach(stage: LightPort & SceneStills): void {
    this.#stage = stage;
    if (this.#program !== null) stage.setProgram(this.#program);
    for (const change of this.#changes) stage.setAudibility(change);
    stage.setMode(this.#mode);
  }

  useClock(clock: HeardClock): void {
    this.#source = clock;
  }

  setMode(mode: StageMode): void {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#stage?.setMode(mode);
  }

  setProgram(program: LightProgram): void {
    this.#program = program;
    this.#changes = [];
    this.#stage?.setProgram(program);
  }

  setAudibility(change: AudibilityChange): void {
    this.#changes.push(change);
    this.#stage?.setAudibility(change);
  }

  still(size: { readonly width: number; readonly height: number }, keepOut: KeepOut): Promise<Blob | null> {
    return this.#stage?.still(size, keepOut) ?? Promise.resolve(null);
  }
  schedule(cues: readonly LightCue[], timeline: LightTimeline): void {
    if (this.#mode === "live") this.#stage?.schedule(cues, timeline);
  }
}
