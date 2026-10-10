// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BarBudgetCache } from "./bar-budget-cache";
import { CueStore, KEEP_SECONDS } from "../cues/cue-store";
import { allocateBar } from "./scene-budget";
import { fixtureProgram, grooveCues, loadManifests, stressProduction, type FixtureFiles } from "../testing/light-fixtures";

// The cache shares the work of the bar's budget between the instants the composer asks
// for; it must never change the answer allocateBar gives.

const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = 2;
const stress = fixtureProgram(stressProduction(manifests), manifests).program;

describe("bar budget cache", () => {
  it("answers what allocateBar answers at every instant, as cues arrive in batches", () => {
    const cues = grooveCues(stress, 4, SECONDS_PER_BAR);
    const cached = new CueStore();
    const reference = new CueStore();
    const cache = new BarBudgetCache();
    let sent = 0;
    for (let now = 0; now < 4 * SECONDS_PER_BAR; now += 1 / 120) {
      // A batch every 50 ms carries the cues of the next 100 ms, as the worker sends them.
      if (Math.round(now * 120) % 6 === 0) {
        const batch = cues.slice(sent).filter((cue) => cue.audioTime <= now + 0.1);
        cached.add(batch);
        reference.add(batch);
        sent += batch.length;
      }
      const bar = Math.floor(now / SECONDS_PER_BAR);
      for (const asked of [bar, bar - 1]) {
        expect(cache.allocate(stress, stress.scenes, cached, asked, SECONDS_PER_BAR, now)).toEqual(allocateBar(stress.scenes, reference, asked, SECONDS_PER_BAR, now));
      }
    }
  });

  it("plans again when a prune reaches the bars it read", () => {
    const cues = grooveCues(stress, 2, SECONDS_PER_BAR);
    const store = new CueStore();
    store.add(cues);
    const cache = new BarBudgetCache();
    const before = cache.allocate(stress, stress.scenes, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1);
    store.prune(KEEP_SECONDS + SECONDS_PER_BAR + 0.5);
    const after = cache.allocate(stress, stress.scenes, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1);
    expect(after).toEqual(allocateBar(stress.scenes, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1));
    expect(after).not.toEqual(before);
  });

  it("plans again for another program or another set of audible tracks", () => {
    const store = new CueStore();
    store.add(grooveCues(stress, 2, SECONDS_PER_BAR));
    const cache = new BarBudgetCache();
    const half = stress.scenes.slice(0, 32);
    cache.allocate(stress, stress.scenes, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1);
    expect(cache.allocate(stress, half, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1)).toEqual(allocateBar(half, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1));
    const other = { ...stress };
    expect(cache.allocate(other, half, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1)).toEqual(allocateBar(half, store, 1, SECONDS_PER_BAR, SECONDS_PER_BAR + 1));
  });
});
