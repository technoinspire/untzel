// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Composer, type Composition } from "./composer";
import { MAX_AREAS, MAX_PRIMITIVES } from "./scene-primitive";
import { fixtureProgram, grooveCues, loadManifests, stressProduction, templateTracks, timelines, type FixtureFiles } from "../testing/light-fixtures";
// composeAt(t): a pure function of the cues received and of t. The same text gives
// the same frames whatever the batch size or frame rate; mute and solo only change which
// tracks light; the budget and the area cap hold with 64 tracks.

const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = (4 * 60) / 124;
const BARS = 4;
const onboard = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests);

/** Everything delivered at once, as the export's one batch per bar ends up holding. */
function wholeComposer(program = onboard.program): Composer {
  const composer = new Composer();
  composer.setProgram(program);
  const cues = grooveCues(program, BARS, SECONDS_PER_BAR);
  for (const timeline of timelines(BARS, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
  return composer;
}

const instants = (fps: number): readonly number[] => Array.from({ length: Math.floor(BARS * SECONDS_PER_BAR * fps) }, (_, frame) => frame / fps);

describe("Composer.composeAt", () => {
  it("gives the same composition for the same cues", () => {
    const a = wholeComposer();
    const b = wholeComposer();
    for (const t of instants(30)) expect(a.composeAt(t, false)).toEqual(b.composeAt(t, false));
  });

  it("does not depend on the batch size: 25 ms batches 100 ms ahead give the export's frames", () => {
    const exported = wholeComposer();
    const live = new Composer();
    live.setProgram(onboard.program);
    const cues = grooveCues(onboard.program, BARS, SECONDS_PER_BAR);
    const bars = timelines(BARS, SECONDS_PER_BAR);
    let sent = 0;
    let window = 0;
    for (const t of instants(30)) {
      // Deliver every 25 ms window that starts before t + 100 ms, as the transport does.
      while (window * 0.025 < t + 0.1) {
        const end = (window + 1) * 0.025;
        const batch: (typeof cues)[number][] = [];
        while (sent < cues.length && (cues[sent]?.audioTime ?? Infinity) < end) batch.push(cues[sent++] as (typeof cues)[number]);
        const boundary = bars.find((timeline) => timeline.audioTime >= window * 0.025 && timeline.audioTime < end) ?? bars.filter((timeline) => timeline.audioTime < end).at(-1);
        if (boundary !== undefined) live.schedule(batch, boundary);
        window += 1;
      }
      expect(live.composeAt(t, false)).toEqual(exported.composeAt(t, false));
      live.prune(t);
    }
    expect(exported.composeAt(SECONDS_PER_BAR * 2.5, false).primitives.length).toBeGreaterThan(20);
  });

  it("takes a muted track out within a beat and leaves the others where they were", () => {
    const muteAt = 2 * SECONDS_PER_BAR;
    const muted = wholeComposer();
    muted.setAudibility({ audioTime: muteAt, audible: new Set([...onboard.program.audible].filter((track) => track !== "kick")) });
    const silent = wholeComposer(fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests, { silent: ["kick"] }).program);
    const after = instants(30).filter((t) => t >= muteAt + SECONDS_PER_BAR / 4 + 0.4);
    for (const t of after) expect(muted.composeAt(t, false).primitives).toEqual(silent.composeAt(t, false).primitives);
    // Control: before the mute the kick still draws, so the two differ.
    const before = instants(30).filter((t) => t > 0.5 && t < muteAt);
    expect(before.some((t) => muted.composeAt(t, false).primitives.length !== silent.composeAt(t, false).primitives.length)).toBe(true);
    // The scenes were placed once: muting moves no anchor.
    const kept = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests, { silent: ["kick"] }).program;
    expect([...kept.anchors]).toEqual([...onboard.program.anchors]);
  });

  it("keeps 64 tracks inside the budget: at most 192 primitives, 64 of them area light, each zone's area light at most 1", () => {
    const stress = fixtureProgram(stressProduction(manifests), manifests).program;
    const composer = wholeComposer(stress);
    for (const t of instants(30)) {
      const { primitives } = composer.composeAt(t, false);
      expect(primitives.length).toBeLessThanOrEqual(MAX_PRIMITIVES);
      const areas = primitives.filter((primitive) => primitive.layer === "area");
      expect(areas.length).toBeLessThanOrEqual(MAX_AREAS);
      const byZone = new Map<string, number>();
      for (const area of areas) byZone.set(area.zone, (byZone.get(area.zone) ?? 0) + area.intensity);
      for (const sum of byZone.values()) expect(sum).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("under the main-thread relief drops only the light versions: every full layer draws the same", () => {
    const stress = fixtureProgram(stressProduction(manifests), manifests).program;
    const composer = wholeComposer(stress);
    const figures = (composition: Composition) => composition.primitives.filter((primitive) => primitive.layer === "figure");
    const areas = (composition: Composition) => composition.primitives.filter((primitive) => primitive.layer === "area");
    let dropped = 0;
    for (const t of instants(30).filter((time) => time > SECONDS_PER_BAR)) {
      const full = composer.composeAt(t, false);
      const relieved = composer.composeAt(t, false, "full-layers-only");
      // The same tracks are over the budget and the same sky lights; a light version is one
      // area, so the full layers' figures are untouched and only areas can go.
      expect(relieved.lightTracks).toEqual(full.lightTracks);
      expect(relieved.sky).toEqual(full.sky);
      expect(figures(relieved)).toEqual(figures(full));
      expect(areas(relieved).length).toBeLessThanOrEqual(areas(full).length);
      dropped += full.primitives.length - relieved.primitives.length;
    }
    expect(dropped).toBeGreaterThan(0);
  });

  it("composes 64 tracks fast enough for a frame: p95 under 2 ms of CPU", () => {
    const stress = fixtureProgram(stressProduction(manifests), manifests).program;
    const composer = wholeComposer(stress);
    const times: number[] = [];
    // CPU time, not wall time: on a loaded machine (the parallel suites) a descheduled
    // thread would count someone else's work as ours.
    for (const t of instants(60)) {
      const started = process.cpuUsage();
      composer.composeAt(t, false);
      const spent = process.cpuUsage(started);
      times.push((spent.user + spent.system) / 1000);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(2);
  });

  it("keeps the drop lit under reduced motion: content never depends on animation", () => {
    const composer = wholeComposer();
    const lit = (composition: Composition): number => composition.primitives.reduce((sum, primitive) => sum + primitive.intensity, 0);
    for (const t of instants(10).filter((time) => time > 0.5)) expect(lit(composer.composeAt(t, true))).toBeGreaterThan(0.5);
  });
});
