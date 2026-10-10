// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { fileKeepOut, screenKeepOut } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { Composer } from "./composer";
import { LARGE_AREA_ATTACK_S } from "../families/family-context";
import { SKY_ATMOSPHERE_GAIN, SKY_BREATH_DEPTH, breathAt, skyAtmosphere, skyLevel } from "./sky-atmosphere";
import { fixtureProgram, grooveCues, loadManifests, templateTracks, timelines, type FixtureFiles } from "../testing/light-fixtures";
import { EXPOSURE_SLIDE_S } from "./zone-exposure";
// The sky's atmosphere of an exported frame: its level
// follows the sky's energy and slides at a bar start; on top of it the haze breathes on the
// beat with the groove, rising no faster than the large-area rule.

const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = (4 * 60) / 124;
const { program } = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests);
const sky = program.scenes.filter((scene) => scene.zone === "sky");
const STILL = { beat: 0, secondsPerBeat: SECONDS_PER_BAR / 4, isReduced: false };

describe("sky atmosphere", () => {
  it("is the sky tracks' energy, held to the gain, and 0 without a sky track", () => {
    expect(sky.length).toBeGreaterThan(0);
    const full = new Map(sky.map((scene) => [scene.track, { isFull: true, energy: 1 }] as const));
    expect(skyLevel(sky.map((scene) => ({ scene, gain: 1 })), full)).toBe(SKY_ATMOSPHERE_GAIN);
    expect(skyLevel([], full)).toBe(0);
    const ground = program.scenes.filter((scene) => scene.zone !== "sky");
    expect(skyAtmosphere(ground.map((scene) => ({ scene, gain: 1 })), full, full, 1, STILL)).toEqual({ level: 0, breath: 0, color: 0 });
  });

  it("slides from the bar before's level over 0.35 s and takes the strongest sky track's colour", () => {
    const [first, second] = sky;
    if (first === undefined || second === undefined) throw new Error("two sky tracks expected");
    const tracks = [first, second].map((scene) => ({ scene, gain: 1 }));
    const before = new Map([[first.track, { isFull: true, energy: 0.2 }]]);
    const now = new Map([
      [first.track, { isFull: true, energy: 0.2 }],
      [second.track, { isFull: true, energy: 0.6 }],
    ]);
    expect(skyAtmosphere(tracks, now, before, 0, STILL).level).toBeCloseTo(SKY_ATMOSPHERE_GAIN * 0.2, 12);
    expect(skyAtmosphere(tracks, now, before, EXPOSURE_SLIDE_S / 2, STILL).level).toBeCloseTo(SKY_ATMOSPHERE_GAIN * 0.5, 12);
    expect(skyAtmosphere(tracks, now, before, EXPOSURE_SLIDE_S, STILL)).toEqual({ level: SKY_ATMOSPHERE_GAIN * 0.8, breath: 0, color: second.colorIndex });
  });

  it("in a steady drop: the level holds, and the breath follows every beat", () => {
    const composer = new Composer();
    composer.setProgram(program);
    const cues = grooveCues(program, 6, SECONDS_PER_BAR);
    for (const timeline of timelines(6, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
    const frames = Array.from({ length: 4 * 120 }, (_, frame) => composer.composeAt(2 * SECONDS_PER_BAR + frame / 120, false).sky);
    const levels = frames.map((frame) => frame.level);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1e-9);
    expect(levels[0]).toBeGreaterThan(0.3);
    const breaths = frames.map((frame) => frame.breath);
    expect(Math.max(...breaths)).toBeGreaterThan(SKY_BREATH_DEPTH * 0.9);
    expect(Math.min(...breaths)).toBeLessThan(0.01);
    // One rise per beat: 4 s at 124 BPM hold 8.3 beats.
    const crossings = breaths.filter((value, index) => index > 0 && value >= SKY_BREATH_DEPTH / 2 && (breaths[index - 1] ?? 0) < SKY_BREATH_DEPTH / 2);
    expect(crossings.length).toBeGreaterThanOrEqual(8);
    expect(crossings.length).toBeLessThanOrEqual(9);
    // Continuous: no step larger than a 120 Hz slice of the rise allows.
    const steps = breaths.slice(1).map((value, index) => Math.abs(value - (breaths[index] ?? 0)));
    expect(Math.max(...steps)).toBeLessThan(SKY_BREATH_DEPTH * 0.15);
  });
  it("rises over at least the large-area attack, is 0 on the beat and under reduced motion", () => {
    for (const secondsPerBeat of [60 / 124, 60 / 145, 60 / 174]) {
      expect(breathAt({ beat: 3, secondsPerBeat, isReduced: false })).toBe(0);
      const peakAt = Array.from({ length: 1000 }, (_, step) => step / 1000).reduce((best, phase) => (breathAt({ beat: phase, secondsPerBeat, isReduced: false }) > breathAt({ beat: best, secondsPerBeat, isReduced: false }) ? phase : best), 0);
      expect(peakAt * secondsPerBeat).toBeGreaterThanOrEqual(LARGE_AREA_ATTACK_S);
      expect(breathAt({ beat: 0.999, secondsPerBeat, isReduced: false })).toBeLessThan(0.001);
    }
    expect(breathAt({ beat: 0.3, secondsPerBeat: 0.5, isReduced: true })).toBe(0);
    const composer = new Composer();
    composer.setProgram(program);
    const cues = grooveCues(program, 4, SECONDS_PER_BAR);
    for (const timeline of timelines(4, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
    for (let frame = 0; frame < 120; frame += 1) expect(composer.composeAt(2 * SECONDS_PER_BAR + frame / 60, true).sky.breath).toBe(0);
  });
  it("is the same on the page and in the file: only the frame decides whether it is drawn", () => {
    // The keep-out never reaches the composer: placement and composition do not depend on it.
    const page = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests, { keepOut: screenKeepOut(MEASURED_BRAND_ZONES) }).program;
    const file = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests, { keepOut: fileKeepOut(MEASURED_BRAND_ZONES) }).program;
    expect([...file.anchors]).toEqual([...page.anchors]);
    expect(file.scenes).toEqual(page.scenes);
  });
});
