// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import type { SceneAnchor, SceneDescription } from "@untzel/scene";
import { describe, expect, it } from "vitest";
import { coverage } from "../safety/luminance";
import type { LightCue } from "../ports";
import { FigureKind, isEdgeToEdge, type ScenePrimitive } from "../composer/scene-primitive";
import { fixtureProgram, grooveCues, loadManifests, stressProduction, templateTracks, type FixtureFiles } from "../testing/light-fixtures";
import { LARGE_AREA_ATTACK_S } from "./family-context";
import { cuePrimitives, lifeOf } from "./family-table";
// The eleven families against their rules, over every
// scene of the four compared productions and the 64-track load, with the groove's own cues:
// figures stay in their anchor's reach, a core figure stays inside its band, the curl grain
// never leaves its cell, any primitive lighting more than a quarter of the square rises over
// at least 120 ms, and under reduced motion a pulse neither grows nor travels.
const ROOT = new URL("../../../../", import.meta.url);
const files: FixtureFiles = { list: (directory) => readdirSync(new URL(`${directory}/`, ROOT)), read: (path) => readFileSync(new URL(path, ROOT), "utf8") };
const manifests = loadManifests(files);
const SECONDS_PER_BAR = (4 * 60) / 124;
const SQUARE_AREA = 4;
const PRODUCTIONS = [
  ...["melodic-techno/midnight-bloom", "afro-house/red-earth", "indie-dance/coastline", "psytrance/full-moon"].map((id) => templateTracks(files, id)),
  stressProduction(manifests),
];
interface Case {
  readonly scene: SceneDescription;
  readonly anchor: SceneAnchor;
  readonly cues: readonly LightCue[];
}
const CASES: readonly Case[] = PRODUCTIONS.flatMap((tracks) => {
  const { program } = fixtureProgram(tracks, manifests);
  const cues = grooveCues(program, 1, SECONDS_PER_BAR);
  return program.scenes.flatMap((scene) => {
    const anchor = program.anchors.get(scene.track);
    return anchor === undefined ? [] : [{ scene, anchor, cues: cues.filter((cue) => cue.track === scene.track) }];
  });
});
const FULL = { isFull: true, energy: 1 } as const;
/** The primitives of one cue at `age` seconds into its life. */
function at(entry: Case, cue: LightCue, age: number, isReduced: boolean, beat = 8): readonly ScenePrimitive[] {
  return cuePrimitives(entry.scene, entry.anchor, cue, cue.audioTime + age, { isReduced, beat }, FULL);
}
/** Ages across a cue's life, its rise sampled finely. */
function ages(entry: Case, cue: LightCue): readonly number[] {
  const life = lifeOf(entry.scene, cue);
  return [0.002, 0.01, 0.03, 0.06, 0.09, 0.12, ...Array.from({ length: 12 }, (_, index) => (life * (index + 1)) / 13)];
}
const label = (entry: Case) => `${entry.scene.track} (${entry.scene.family}/${entry.scene.shape})`;
describe("families", { timeout: 60_000 }, () => {
  it("covers every family", () => {
    expect(new Set(CASES.map((entry) => entry.scene.family)).size).toBe(11);
    expect(CASES.every((entry) => entry.cues.length > 0)).toBe(true);
  });
  it("places every figure that is not edge to edge inside its anchor's reach", () => {
    for (const entry of CASES) {
      const { anchor } = entry;
      for (const cue of entry.cues) {
        for (const age of ages(entry, cue)) {
          for (const primitive of at(entry, cue, age, false)) {
            if (primitive.layer !== "figure" || isEdgeToEdge(primitive)) continue;
            expect(Math.abs(primitive.x - anchor.x), `${label(entry)} x`).toBeLessThanOrEqual(anchor.reachX + 1e-9);
            expect(Math.abs(primitive.y - anchor.y), `${label(entry)} y`).toBeLessThanOrEqual(anchor.reachY + 1e-9);
          }
        }
      }
    }
  });
  it("keeps a core ring's radius plus its stroke inside its band", () => {
    for (const entry of CASES.filter((candidate) => candidate.anchor.band !== null)) {
      const band = entry.anchor.band;
      if (band === null) continue;
      for (const cue of entry.cues) {
        for (const age of ages(entry, cue)) {
          for (const primitive of at(entry, cue, age, false)) {
            if (primitive.layer !== "figure" || primitive.kind !== FigureKind.Ring) continue;
            expect(primitive.size + primitive.width, label(entry)).toBeLessThanOrEqual(band.to + 1e-9);
          }
        }
      }
    }
  });
  it("keeps the curl grain inside its cell over its whole life", () => {
    const grains = CASES.filter((entry) => entry.scene.family === "sparks" && entry.scene.shape === "grain");
    expect(grains.length).toBeGreaterThan(0);
    for (const entry of grains) {
      const { anchor } = entry;
      for (const cue of entry.cues) {
        for (const age of ages(entry, cue)) {
          for (const primitive of at(entry, cue, age, false)) {
            if (primitive.layer !== "figure" || primitive.kind !== FigureKind.Dot) continue;
            expect(Math.abs(primitive.x - anchor.x), label(entry)).toBeLessThanOrEqual(anchor.reachX * 0.9 + 1e-9);
            expect(Math.abs(primitive.y - anchor.y), label(entry)).toBeLessThanOrEqual(anchor.reachY * 0.8 + 1e-9);
          }
        }
      }
    }
  });
  it("raises any primitive lighting more than a quarter of the square over at least 120 ms", () => {
    let large = 0;
    for (const entry of CASES) {
      for (const cue of entry.cues) {
        for (const age of [0.002, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1]) {
          for (const primitive of at(entry, cue, age, false)) {
            if (Math.min(SQUARE_AREA, coverage(primitive)) / SQUARE_AREA <= 0.25) continue;
            large += 1;
            // At most a straight rise from 0 to full over LARGE_AREA_ATTACK_S.
            expect(primitive.intensity, `${label(entry)} at ${age} s`).toBeLessThanOrEqual(age / LARGE_AREA_ATTACK_S + 1e-9);
          }
        }
      }
    }
    expect(large).toBeGreaterThan(0);
  });
  it("under reduced motion: flow frozen, nothing grows or travels over a pulse's life", () => {
    for (const entry of CASES) {
      for (const cue of entry.cues) {
        const life = lifeOf(entry.scene, cue);
        const shapes = [0.2, 0.5, 0.8].map((share) => at(entry, cue, Math.max(0.36, life * share), true, 0));
        for (const primitives of shapes) for (const primitive of primitives) expect(primitive.flow, label(entry)).toBe(0);
        const geometry = (primitives: readonly ScenePrimitive[]) => primitives.map(({ x, y, size, aspect, rotation }) => [x, y, size, aspect, rotation]);
        const [first, ...rest] = shapes.map(geometry);
        for (const later of rest) if (first !== undefined && later.length === first.length) expect(later, label(entry)).toEqual(first);
      }
    }
  });
});
