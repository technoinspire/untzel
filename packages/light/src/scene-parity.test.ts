// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { fileKeepOut, screenKeepOut } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { Composer } from "./composer/composer";
import { STAGE_PRE_ROLL_S } from "./composer/feedback-schedule";
import { FrameDriver } from "./stage/frame-driver";
import type { DrawnFrame, StageRenderer } from "./renderers/renderer";
import { fitScene, sceneSquare } from "./composer/scene-fit";
import { fixtureProgram, grooveCues, loadManifests, templateTracks, timelines, type FixtureFiles } from "./testing/light-fixtures";
// One composition on every surface: the same program drawn on
// the 1440 × 900 page's stage, the phone's, the 16:9 file and the story gives the same
// primitives once each stage's placement is divided by its unit, so the screen and the
// video show the same composition and only the room past the square changes.
const ROOT = new URL("../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = (4 * 60) / 124;
const SURFACES = [
  { name: "page 1440", width: 1440, height: 430, isFile: false },
  { name: "page 390", width: 390, height: 352, isFile: false },
  { name: "16:9", width: 1920, height: 1080, isFile: true },
  { name: "story", width: 1080, height: 1920, isFile: true },
] as const;
const INSTANTS = Array.from({ length: 12 }, (_, frame) => 2 * SECONDS_PER_BAR + frame / 6);
function drawn(template: string, surface: (typeof SURFACES)[number]): DrawnFrame[] {
  const { program } = fixtureProgram(templateTracks(files, template), manifests);
  const frames: DrawnFrame[] = [];
  const renderer: StageRenderer = { kind: "2d", resize: () => undefined, stepTrail: () => undefined, clearTrail: () => undefined, present: (frame) => void frames.push(frame), destroy: () => undefined };
  const composer = new Composer();
  composer.setProgram(program);
  const cues = grooveCues(program, 4, SECONDS_PER_BAR);
  for (const timeline of timelines(4, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
  const keepOut = surface.isFile ? fileKeepOut(MEASURED_BRAND_ZONES) : screenKeepOut(MEASURED_BRAND_ZONES);
  const driver = new FrameDriver({ composer, renderer, keepOut, isReduced: false, preRoll: STAGE_PRE_ROLL_S });
  for (const t of INSTANTS) driver.drawAt(t, surface);
  return frames;
}
/** The placed primitives back in u. */
function inUnits(frame: DrawnFrame) {
  return frame.primitives.map((primitive) => ({ ...primitive, x: primitive.x / frame.unit, y: primitive.y / frame.unit, size: primitive.size / frame.unit, width: primitive.width / frame.unit }));
}
describe("scene parity across surfaces", () => {
  it.each(["melodic-techno/midnight-bloom", "afro-house/red-earth", "indie-dance/coastline", "psytrance/full-moon"])("%s: the same primitives in u on the page, the phone, the 16:9 and the story", (template) => {
    const [reference, ...others] = SURFACES.map((surface) => drawn(template, surface));
    expect(reference?.length).toBe(INSTANTS.length);
    for (const frames of others) {
      frames.forEach((frame, index) => {
        const base = reference?.[index];
        if (base === undefined) throw new Error("missing frame");
        const ours = inUnits(frame);
        const theirs = inUnits(base);
        expect(ours.length).toBe(theirs.length);
        ours.forEach((primitive, at) => {
          const other = theirs[at];
          for (const key of ["x", "y", "size", "width", "intensity", "color", "kind", "aspect", "rotation", "extra"] as const) expect(primitive[key]).toBeCloseTo(other?.[key] ?? Number.NaN, 9);
        });
        expect(frame.palette).toEqual(base.palette);
      });
    }
    // Four surfaces with the trail's pre-roll: about 1 s on an idle machine, more beside other suites.
  }, 60_000);
  it("maps u by each stage's own unit, half the safe area's shorter side", () => {
    for (const surface of SURFACES) {
      const frame = drawn("melodic-techno/midnight-bloom", surface)[0];
      expect(frame?.unit).toBeCloseTo(sceneSquare(fitScene(surface)).unit, 12);
    }
  });
});
