// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { chooseScene, coreCentre, placeScenes, stagePlan, type KeepOut, type SceneDescription, type SceneManifest } from "@untzel/scene";
import type { LightProgram } from "../ports";
// A program's scenes, chosen and placed once: every track of the text, audible or
// not, so mute and solo never move a scene. Pure over @untzel/scene.

export interface ProgramTrack {
  readonly name: string;
  readonly instrument: string;
  /** -1..1, the activation's constant pan. */
  readonly pan: number;
  readonly isAudible: boolean;
}

export interface ProgramSource {
  readonly audioTime: number;
  readonly tracks: readonly ProgramTrack[];
  readonly lightSourceHash: number;
  readonly stagePlanHash: number;
}

export function buildLightProgram(source: ProgramSource, manifestOf: (instrument: string) => SceneManifest | undefined, keepOut: KeepOut): LightProgram {
  const scenes: SceneDescription[] = [];
  for (const track of source.tracks) {
    const manifest = manifestOf(track.instrument);
    if (manifest !== undefined) scenes.push(chooseScene(manifest, track, { lightSourceHash: source.lightSourceHash }));
  }
  const plan = stagePlan(source.stagePlanHash);
  return {
    audioTime: source.audioTime,
    scenes,
    anchors: placeScenes(scenes, plan, keepOut),
    audible: new Set(source.tracks.filter((track) => track.isAudible).map((track) => track.name)),
    lightSourceHash: source.lightSourceHash,
    stagePlanHash: source.stagePlanHash,
    coreX: coreCentre(plan).x,
  };
}
