// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { parseManifest, type InstrumentManifest, type SceneFamily } from "@untzel/core";
import type { KeepOut, SceneDescription } from "@untzel/scene";
import { MEASURED_KEEP_OUT, productionTracks, stressTracks, type ProductionTrack } from "@untzel/scene/testing";
import { buildLightProgram } from "../cues/light-program";
import type { LightCue, LightProgram, LightTimeline } from "../ports";
// Test fixtures for the light: a program built with the real manifests and a
// groove of cues per family, the way the transport would schedule a drop, without running
// the language or the DSP. The tests read the manifests themselves (no node: here).

const TICKS_PER_BAR = 96;
/** Ticks inside a bar each family plays, a plain drop groove. */
const RHYTHM: Readonly<Record<SceneFamily, readonly number[]>> = {
  shockwave: [0, 24, 48, 72],
  sparks: [12, 36, 60, 84],
  burst: [24, 72],
  floor: [0, 12, 24, 36, 48, 60, 72, 84],
  ribbon: [0, 6, 18, 30, 42, 48, 54, 66, 78, 90],
  fog: [0],
  halo: [0, 48],
  bars: [0, 24, 48, 72],
  mark: [6, 30, 54, 78],
  ripple: [18, 66],
  sweep: [0],
};

/** The file system the tests hand in: the repository's instruments/ and templates. */
export interface FixtureFiles {
  readonly list: (directory: string) => readonly string[];
  readonly read: (path: string) => string;
}

/** Every instrument's manifest, by name. */
export function loadManifests(files: FixtureFiles): ReadonlyMap<string, InstrumentManifest> {
  return new Map(
    files.list("instruments").flatMap((name) => {
      try {
        const result = parseManifest(JSON.parse(files.read(`instruments/${name}/manifest.json`)));
        return result.ok ? [[result.manifest.name, result.manifest] as const] : [];
      } catch {
        return [];
      }
    }),
  );
}

/** A template's tracks, read the simple way (name, instrument, pan). */
export function templateTracks(files: FixtureFiles, id: string): readonly ProductionTrack[] {
  return productionTracks(files.read(`apps/web/src/templates/${id}.untzel`));
}

export interface FixtureProgram {
  readonly program: LightProgram;
  readonly scenes: ReadonlyMap<string, SceneDescription>;
}

export function fixtureProgram(
  tracks: readonly ProductionTrack[],
  manifests: ReadonlyMap<string, InstrumentManifest>,
  options: { readonly audioTime?: number; readonly hash?: number; readonly keepOut?: KeepOut; readonly silent?: readonly string[] } = {},
): FixtureProgram {
  const hash = options.hash ?? 0x5eed;
  const silent = new Set(options.silent ?? []);
  const program = buildLightProgram(
    { audioTime: options.audioTime ?? 0, tracks: tracks.map((track) => ({ ...track, isAudible: !silent.has(track.name) })), lightSourceHash: hash, stagePlanHash: hash },
    (instrument) => manifests.get(instrument),
    options.keepOut ?? MEASURED_KEEP_OUT,
  );
  return { program, scenes: new Map(program.scenes.map((scene) => [scene.track, scene])) };
}

/** The 64-track load production over every instrument. */
export function stressProduction(manifests: ReadonlyMap<string, InstrumentManifest>): readonly ProductionTrack[] {
  return stressTracks([...manifests.keys()].sort());
}

/** `bars` bars of cues for every scene of the program, from bar `firstBar`. */
export function grooveCues(program: LightProgram, bars: number, secondsPerBar: number, firstBar = 0): readonly LightCue[] {
  const cues: LightCue[] = [];
  for (let bar = firstBar; bar < firstBar + bars; bar += 1) {
    for (const scene of program.scenes) {
      for (const tick of RHYTHM[scene.family]) cues.push(cueAt(scene, bar, tick, secondsPerBar));
    }
  }
  return cues.sort((a, b) => a.audioTime - b.audioTime);
}

/** The bar boundaries of `bars` bars at a constant tempo. */
export function timelines(bars: number, secondsPerBar: number, section: string | null = "drop"): readonly LightTimeline[] {
  return Array.from({ length: bars + 1 }, (_, bar) => ({ audioTime: bar * secondsPerBar, bar, secondsPerBar, section }));
}

function cueAt(scene: SceneDescription, bar: number, tick: number, secondsPerBar: number): LightCue {
  const isHeld = scene.family === "fog" || scene.family === "halo" || scene.family === "sweep";
  const isPitched = scene.family === "floor" || scene.family === "ribbon" || isHeld;
  return {
    track: scene.track,
    audioTime: (bar + tick / TICKS_PER_BAR) * secondsPerBar,
    duration: isHeld ? secondsPerBar / 2 : secondsPerBar / 16,
    velocity: tick % 24 === 0 ? 0.95 : 0.75,
    isAccent: tick === 0,
    tone: 0.6,
    toneMotion: null,
    pitches: isPitched ? (isHeld ? [57, 60, 64] : [36 + (tick % 5)]) : [],
    tunePosition: isPitched ? null : 0.5,
    attack: isHeld ? 0.2 : 0.005,
    release: isHeld ? 1 : 0.2,
    bar,
    tick,
    section: "drop",
  };
}
