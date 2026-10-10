// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { TOP_CHROME_KEEP_OUT_Y, distanceToBox, stagePlan } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { MEASURED_BRAND_ZONES } from "@untzel/scene/testing";
import { Composer } from "./composer/composer";
import { AreaKind, FigureKind, type Figure, type ScenePrimitive } from "./composer/scene-primitive";
import { fixtureProgram, grooveCues, loadManifests, stressProduction, templateTracks, timelines, type FixtureFiles } from "./testing/light-fixtures";
// What the families draw stays out of the chrome band and off the brand zones,
// in the four productions and the 64-track load, in every arrangement: the frames
// the stage and the export compose, not only the anchors.

const ROOT = new URL("../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = 2;
const PRODUCTIONS = ["melodic-techno/midnight-bloom", "afro-house/red-earth", "indie-dance/coastline", "psytrance/full-moon"].map((id) => templateTracks(files, id));
/** One stage-plan hash per arrangement. */
const HASHES = [0, 1, 2, 3].map((arrangement) => {
  for (let hash = 1; hash < 10_000; hash += 1) if (stagePlan(hash).arrangement === arrangement) return hash;
  throw new Error(`no hash gives arrangement ${arrangement}`);
});

/** The highest point a figure's stroke reaches, in u (y down). */
function figureTop(figure: Figure): number {
  switch (figure.kind) {
    case FigureKind.Needle:
    case FigureKind.DashPair:
      return figure.y - figure.size / 2;
    case FigureKind.Square:
      return figure.y - figure.size * Math.SQRT2;
    case FigureKind.Ellipse:
    case FigureKind.Bar:
      return figure.y - figure.size * figure.aspect;
    case FigureKind.Line:
    case FigureKind.Comb:
      return figure.y - Math.abs(figure.size);
    default:
      return figure.y - figure.size;
  }
}

function framesOf(tracks: (typeof PRODUCTIONS)[number], hash: number): readonly (readonly ScenePrimitive[])[] {
  const { program } = fixtureProgram(tracks, manifests, { hash });
  const composer = new Composer();
  composer.setProgram(program);
  const cues = grooveCues(program, 3, SECONDS_PER_BAR);
  for (const timeline of timelines(3, SECONDS_PER_BAR)) composer.schedule(timeline.bar === 0 ? cues : [], timeline);
  return Array.from({ length: 3 * 15 }, (_, frame) => composer.composeAt((frame / 15) * SECONDS_PER_BAR / 2 + 0.01, false).primitives);
}

describe("composed frames and the keep-out", () => {
  const cases = [...PRODUCTIONS, stressProduction(manifests)].flatMap((tracks, production) => HASHES.map((hash) => [production, hash, tracks] as const));

  // Figures obey the line by placement. Soft area light may reach past it: the page's top
  // mask cuts it under the bar, and a file, which has no bar, shows it (frame-driver.test.ts).
  it.each(cases)("production %i, plan %i: no figure above the chrome line", (_, hash, tracks) => {
    for (const primitives of framesOf(tracks, hash)) {
      for (const primitive of primitives) if (primitive.layer === "figure") expect(figureTop(primitive)).toBeGreaterThanOrEqual(TOP_CHROME_KEEP_OUT_Y - 0.03);
    }
  });

  it.each(cases)("production %i, plan %i: no figure centre and no ground light inside a brand zone", (_, hash, tracks) => {
    for (const primitives of framesOf(tracks, hash)) {
      for (const primitive of primitives) {
        if (primitive.layer === "area" && (primitive.kind === AreaKind.Band || primitive.kind === AreaKind.Rise)) {
          // The floor and the ground run edge to edge: their light ends above every zone's top.
          // Other soft bands (a lane's haze with 64 tracks) are cut by the brand mask.
          if (primitive.zone !== "floor" && primitive.zone !== "ground") continue;
          for (const zone of MEASURED_BRAND_ZONES) expect(primitive.y + (primitive.kind === AreaKind.Band ? primitive.size : primitive.aspect)).toBeLessThanOrEqual(zone.minY);
          continue;
        }
        for (const zone of MEASURED_BRAND_ZONES) expect(distanceToBox(primitive.x, primitive.y, zone)).toBeGreaterThan(0);
      }
    }
  });
});
