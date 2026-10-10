// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import {
  isSceneFamily,
  isShapeOf,
  mulberry32,
  trackColorIndex,
  type SceneDensity,
  type SceneDrive,
  type SceneFamily,
  type SceneShape,
  type SceneSpec,
  type SceneTint,
} from "@untzel/core";
import { zoneOf, type SceneZone } from "./scene-catalog";
import { CATEGORY_DEFAULTS, categoryOf, type SceneCategory } from "./scene-defaults";
import { lookSeed, sceneSeed } from "./scene-seeds";
// manifest + track + seeds → SceneDescription. Pure and total: an unknown
// family or shape falls back to the category's default, never throws. Family, shape and
// drive are never drawn; the seed moves only what the manifest leaves free.

/** What a scene reads of a manifest. */
export interface SceneManifest {
  readonly name: string;
  readonly group: string;
  readonly scene: SceneSpec | null;
  readonly tone: readonly { readonly parameter: string }[];
  readonly range: { readonly lowest: number; readonly highest: number } | null;
}

export interface SceneTrack {
  readonly name: string;
  /** -1..1, the activation's constant pan. */
  readonly pan: number;
}

export interface SceneSeeds {
  readonly lightSourceHash: number;
}

export interface SceneDescription {
  readonly track: string;
  readonly instrument: string;
  readonly category: SceneCategory;
  readonly family: SceneFamily;
  readonly shape: SceneShape;
  readonly density: SceneDensity;
  readonly tint: SceneTint;
  readonly drive: SceneDrive;
  readonly zone: SceneZone;
  /** tone[0].parameter of the manifest. */
  readonly toneParameter: string | null;
  /** MIDI; drums and unranged instruments span c1..c7. */
  readonly pitchRange: { readonly lowest: number; readonly highest: number };
  /** 0..7, trackColorIndex(track): the track's colour in code, controls and stage. */
  readonly colorIndex: number;
  readonly lookSeed: number;
  readonly sceneSeed: number;
  /** Radians. */
  readonly rotation: number;
  readonly mirror: 1 | -1;
  /** 0..1. */
  readonly phase: number;
  readonly pan: number;
}

const DEFAULT_RANGE = { lowest: 24, highest: 96 } as const;

export function chooseScene(manifest: SceneManifest, track: SceneTrack, seeds: SceneSeeds): SceneDescription {
  const category = categoryOf(manifest.group);
  const spec = validScene(manifest.scene) ?? CATEGORY_DEFAULTS[category];
  const look = lookSeed(track.name, manifest.name);
  const random = mulberry32(look);
  const rotation = random() * Math.PI * 2;
  const mirror = random() < 0.5 ? -1 : 1;
  const phase = random();
  return {
    track: track.name,
    instrument: manifest.name,
    category,
    family: spec.family,
    shape: spec.variant.shape,
    density: spec.variant.density,
    tint: spec.variant.tint,
    drive: spec.drive,
    zone: zoneOf(spec.family, spec.variant.shape),
    toneParameter: manifest.tone[0]?.parameter ?? null,
    pitchRange: manifest.range ?? DEFAULT_RANGE,
    colorIndex: trackColorIndex(track.name),
    lookSeed: look,
    sceneSeed: sceneSeed(seeds.lightSourceHash, track.name),
    rotation,
    mirror,
    phase,
    pan: Number.isFinite(track.pan) ? Math.min(1, Math.max(-1, track.pan)) : 0,
  };
}

function validScene(scene: SceneSpec | null): SceneSpec | null {
  if (scene === null || !isSceneFamily(scene.family) || !isShapeOf(scene.family, scene.variant.shape)) return null;
  return scene;
}
