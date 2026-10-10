// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { fileKeepOut, screenKeepOut, type KeepOut } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { Composer } from "../composer/composer";
import { STAGE_PRE_ROLL_S } from "../composer/feedback-schedule";
import { FrameDriver } from "./frame-driver";
import { postSettings, type PostSettings } from "../safety/post-light";
import type { DrawnFrame, StageRenderer, TrailWarp } from "../renderers/renderer";
import { fitScene, sceneSquare } from "../composer/scene-fit";
import { fixtureProgram, grooveCues, loadManifests, templateTracks, timelines, type FixtureFiles } from "../testing/light-fixtures";
// The one path from the composer to the pixels. The page and the file draw the
// same primitives, palette, placement and brand zones; only a file, which has no chrome,
// carries the sky's atmosphere over the chrome line and has no top mask (the mask
// left a dark seam in the file).

const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = (4 * 60) / 124;
const { program } = fixtureProgram(templateTracks(files, "melodic-techno/midnight-bloom"), manifests);

/** Draws `instants` and returns what the renderer was handed for each visible frame. */
function presented(keepOut: KeepOut, size: { readonly width: number; readonly height: number }, instants: readonly number[]): DrawnFrame[] {
  const frames: DrawnFrame[] = [];
  const renderer: StageRenderer = {
    kind: "2d",
    resize: () => undefined,
    stepTrail: () => undefined,
    clearTrail: () => undefined,
    present: (frame) => void frames.push(frame),
    destroy: () => undefined,
  };
  const composer = new Composer();
  composer.setProgram(program);
  const cues = grooveCues(program, 4, SECONDS_PER_BAR);
  for (const timeline of timelines(4, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
  const driver = new FrameDriver({ composer, renderer, keepOut, isReduced: false, preRoll: STAGE_PRE_ROLL_S });
  for (const t of instants) driver.drawAt(t, size);
  return frames;
}

const DROP = Array.from({ length: 30 }, (_, frame) => 2 * SECONDS_PER_BAR + frame / 30);

describe("FrameDriver", () => {
  it("on the page: no atmosphere and the chrome band masked, in the stage's own units", () => {
    for (const size of [{ width: 1440, height: 430 }, { width: 390, height: 352 }]) {
      const { unit } = sceneSquare(fitScene(size));
      for (const frame of presented(screenKeepOut(MEASURED_BRAND_ZONES), size, DROP)) {
        expect(frame.atmosphere).toBeNull();
        expect(frame.mask.topY).toBeCloseTo(-0.78 * unit, 12);
      }
    }
  });

  it("in a file: the same primitives, palette and brand zones, the sky's atmosphere and no top mask", () => {
    const size = { width: 1080, height: 1920 };
    const { unit } = sceneSquare(fitScene(size));
    const page = presented(screenKeepOut(MEASURED_BRAND_ZONES), size, DROP);
    const file = presented(fileKeepOut(MEASURED_BRAND_ZONES), size, DROP);
    file.forEach((frame, index) => {
      const same = page[index];
      expect(frame.primitives).toEqual(same?.primitives);
      expect(frame.palette).toEqual(same?.palette);
      expect(frame.mask.boxes).toEqual(same?.mask.boxes);
      expect(frame.mask.feather).toBe(same?.mask.feather);
      expect(frame.mask.topY).toBeNull();
      expect(frame.atmosphere?.lineY).toBeCloseTo(-0.78 * unit, 12);
      expect(frame.atmosphere?.level).toBeGreaterThan(0.3);
    });
  });
});

describe("FrameDriver.setReducedMotion (the menu's switch)", () => {
  it("drops the trail and the full bloom from the next frame, and rebuilds the trail on the way back", () => {
    const events: string[] = [];
    const posts: PostSettings[] = [];
    const renderer: StageRenderer = {
      kind: "2d",
      resize: () => undefined,
      stepTrail: () => void events.push("step"),
      clearTrail: () => void events.push("clear"),
      present: (_frame, _warp, post) => void posts.push(post),
      destroy: () => undefined,
    };
    const composer = new Composer();
    composer.setProgram(program);
    const cues = grooveCues(program, 4, SECONDS_PER_BAR);
    for (const timeline of timelines(4, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
    const driver = new FrameDriver({ composer, renderer, keepOut: screenKeepOut(MEASURED_BRAND_ZONES), isReduced: false, preRoll: STAGE_PRE_ROLL_S });
    const size = { width: 1440, height: 430 };
    const [first, second, third] = [DROP.slice(0, 10), DROP.slice(10, 20), DROP.slice(20)];
    for (const t of first ?? []) driver.drawAt(t, size);
    expect(posts.at(-1)?.hasTrail).toBe(true);
    driver.setReducedMotion(true);
    events.length = 0;
    for (const t of second ?? []) driver.drawAt(t, size);
    expect(events).not.toContain("step");
    expect(posts.at(-1)?.hasTrail).toBe(false);
    expect(posts.at(-1)?.bloom).toBe(postSettings(true, false, 1).bloom);
    driver.setReducedMotion(false);
    expect(events).toEqual(["clear"]);
    for (const t of third ?? []) driver.drawAt(t, size);
    expect(events).toContain("step");
    expect(posts.at(-1)?.hasTrail).toBe(true);
  });
});

describe("FrameDriver.setRelief (the stage's relief of the main thread)", () => {
  it("level 2 draws the limiter's last 120 Hz step with no trail; level 0 composes the frame's instant", () => {
    const events: string[] = [];
    const warps: (TrailWarp | null)[] = [];
    const frames: DrawnFrame[] = [];
    const renderer: StageRenderer = {
      kind: "2d",
      resize: () => undefined,
      stepTrail: () => void events.push("step"),
      clearTrail: () => void events.push("clear"),
      present: (frame, warp) => {
        frames.push(frame);
        warps.push(warp);
      },
      destroy: () => undefined,
    };
    const composer = new Composer();
    composer.setProgram(program);
    const cues = grooveCues(program, 4, SECONDS_PER_BAR);
    for (const timeline of timelines(4, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
    const driver = new FrameDriver({ composer, renderer, keepOut: screenKeepOut(MEASURED_BRAND_ZONES), isReduced: false, preRoll: STAGE_PRE_ROLL_S });
    const size = { width: 1440, height: 430 };
    const [before, after] = [DROP.slice(0, 15), DROP.slice(15)];
    for (const t of before ?? []) expect(driver.drawAt(t, size)).toEqual(composer.composeAt(t, false));
    expect(events).toContain("step");
    driver.setRelief(2);
    expect(events.at(-1)).toBe("clear");
    events.length = 0;
    warps.length = 0;
    for (const t of after ?? []) {
      const drawn = driver.drawAt(t, size);
      const step = Math.floor(t * 120) / 120;
      expect(t - step).toBeLessThan(1 / 120);
      expect(drawn).toEqual(composer.composeAt(step, false, "full-layers-only"));
    }
    expect(events).not.toContain("step");
    expect(warps.every((warp) => warp === null)).toBe(true);
    expect(frames.length).toBe(DROP.length);
  });
});
