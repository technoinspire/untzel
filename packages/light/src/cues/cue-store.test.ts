// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { CueStore, KEEP_SECONDS } from "./cue-store";
import type { LightCue } from "../ports";

const cue = (audioTime: number, bar: number): LightCue => ({
  track: "lead",
  audioTime,
  duration: 0.1,
  velocity: 1,
  isAccent: false,
  tone: 0.5,
  toneMotion: null,
  pitches: [60],
  tunePosition: null,
  attack: 0.01,
  release: 0.1,
  bar,
  tick: 0,
  section: null,
});

describe("cue store", () => {
  it("reads the cues that started in [from, to], oldest first, whatever order they arrived in", () => {
    const store = new CueStore();
    const times = [0.5, 3, 1, 2, 2, 4.5, 0, 6];
    store.add(times.map((time) => cue(time, Math.floor(time / 2))));
    expect(store.between("lead", 1, 4.5).map((found) => found.audioTime)).toEqual([1, 2, 2, 3, 4.5]);
    expect(store.between("lead", 6.5, 9)).toEqual([]);
    expect(store.between("lead", -1, 0)).toHaveLength(1);
    expect(store.between("bass", 0, 9)).toEqual([]);
  });

  it("marks the latest bar a prune removed a cue from", () => {
    const store = new CueStore();
    store.add([cue(0, 0), cue(1.5, 0), cue(2.5, 1), cue(5, 2)]);
    store.prune(KEEP_SECONDS + 1);
    expect(store.latestPrunedBar).toBe(0);
    store.prune(KEEP_SECONDS + 3);
    expect(store.latestPrunedBar).toBe(1);
    expect(store.between("lead", 0, 9).map((found) => found.audioTime)).toEqual([5]);
  });
});
