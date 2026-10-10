// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CueStore } from "../cues/cue-store";
import { primitivesPerPulse } from "../families/family-table";
import { FULL_LAYERS_PER_FAMILY, allocateBar, costOf, energyOf } from "./scene-budget";
import { MAX_PRIMITIVES } from "./scene-primitive";
import { fixtureProgram, grooveCues, loadManifests, stressProduction, type FixtureFiles } from "../testing/light-fixtures";
// The budget: decided per bar from the bar before, in a fixed order, never in the
// order the cues arrived: the screen and the export admit the same layers.

const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = 2;
const stress = fixtureProgram(stressProduction(manifests), manifests).program;
const cues = grooveCues(stress, 3, SECONDS_PER_BAR);

function store(order: "time" | "reversed"): CueStore {
  const value = new CueStore();
  value.add(order === "time" ? cues : [...cues].reverse());
  return value;
}

describe("scene budget", () => {
  it("weighs energy by velocity and length, held to 1", () => {
    const cue = cues[0];
    if (cue === undefined) throw new Error("a cue expected");
    expect(energyOf([], SECONDS_PER_BAR)).toBe(0);
    expect(energyOf([{ ...cue, velocity: 1, duration: 0.5, release: 0 }], SECONDS_PER_BAR)).toBeCloseTo(0.25, 12);
    expect(energyOf(Array.from({ length: 10 }, () => ({ ...cue, velocity: 1, duration: 1, release: 0 })), SECONDS_PER_BAR)).toBe(1);
  });

  it("costs the most pulses alive at once times what one pulse draws", () => {
    const [scene] = stress.scenes;
    if (scene === undefined) throw new Error("a scene expected");
    const one = cues.filter((cue) => cue.track === scene.track && cue.bar === 0);
    expect(costOf(scene, one)).toBeGreaterThanOrEqual(primitivesPerPulse(scene));
    expect(costOf(scene, one) % primitivesPerPulse(scene)).toBe(0);
  });

  it("admits at most 4 full layers per family and keeps 64 tracks inside 192 primitives", () => {
    const versions = allocateBar(stress.scenes, store("time"), 2, SECONDS_PER_BAR, 2 * SECONDS_PER_BAR + 1);
    const perFamily = new Map<string, number>();
    let used = 0;
    for (const scene of stress.scenes) {
      const version = versions.get(scene.track);
      if (version?.isFull !== true) continue;
      perFamily.set(scene.family, (perFamily.get(scene.family) ?? 0) + 1);
      used += costOf(scene, cues.filter((cue) => cue.track === scene.track && cue.bar === 1));
    }
    for (const count of perFamily.values()) expect(count).toBeLessThanOrEqual(FULL_LAYERS_PER_FAMILY);
    expect(used).toBeLessThanOrEqual(MAX_PRIMITIVES);
    expect([...versions.values()].some((version) => !version.isFull)).toBe(true);
  });

  it("gives the same allocation whatever order the cues arrived in", () => {
    for (const bar of [0, 1, 2]) {
      const now = (bar + 0.5) * SECONDS_PER_BAR;
      expect(allocateBar(stress.scenes, store("reversed"), bar, SECONDS_PER_BAR, now)).toEqual(allocateBar(stress.scenes, store("time"), bar, SECONDS_PER_BAR, now));
    }
  });
});
