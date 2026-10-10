// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { sectionHueShift, type SceneDescription, type SceneZone } from "@untzel/scene";
import { CueStore } from "../cues/cue-store";
import { FLOW_PER_BEAT } from "../families/family-context";
import { cuePrimitives } from "../families/family-table";
import type { AudibilityChange, LightCue, LightProgram, LightTimeline } from "../ports";
import { MusicalClock } from "../stage/musical-clock";
import { ProgramTimeline, type LitTrack } from "../cues/program-timeline";
import { BarBudgetCache } from "./bar-budget-cache";
import { FAMILY_WEIGHT, type Version } from "./scene-budget";
import { MAX_PRIMITIVES, type ScenePrimitive } from "./scene-primitive";
import { NO_SKY, skyAtmosphere, type SkyAtmosphere } from "./sky-atmosphere";
import { EXPOSURE_SLIDE_S, capAreas, countByZone, mergeCoincident, zoneScale, zoneScaleAt } from "./zone-exposure";
// composeAt(t): the sum of the scenes of the tracks that sound, as primitives in u.
// A pure function of the cues received and of t, never of the batch they came
// in or of the frame rate, so the stage and the export draw the same frame at the same t.

/** Cues that started this long ago may still be alive (the longest pad and release). */
const LOOK_BACK_S = 14;

export interface Composition {
  readonly primitives: readonly ScenePrimitive[];
  /** Degrees, the section's turn of the palette. */
  readonly paletteShift: number;
  /** The core's centre, in u: the trail contracts towards it. */
  readonly coreX: number;
  readonly stagePlanHash: number;
  /** Tracks drawn as their light version. */
  readonly lightTracks: readonly string[];
  /** The sky's atmosphere, drawn only in a frame without chrome (an exported file). */
  readonly sky: SkyAtmosphere;
  /** Flow-noise time of the atmosphere: the families' flow, 0 under reduced motion. */
  readonly flow: number;
}

/**
 * How much of the scene a composition carries. "full" everywhere but on a stage that relieves
 * the main thread (main-thread-relief.ts): there the tracks over the budget draw nothing
 * instead of their light version, which the 64-area cap mostly drops anyway.
 */
export type CompositionDetail = "full" | "full-layers-only";

export const EMPTY_COMPOSITION: Composition = { primitives: [], paletteShift: 0, coreX: 0, stagePlanHash: 0, lightTracks: [], sky: NO_SKY, flow: 0 };

export class Composer {
  readonly #programs = new ProgramTimeline();
  readonly #cues = new CueStore();
  readonly #clock = new MusicalClock();
  readonly #budget = new BarBudgetCache();

  get clock(): MusicalClock {
    return this.#clock;
  }

  setProgram(program: LightProgram): void {
    this.#programs.setProgram(program);
  }

  setAudibility(change: AudibilityChange): void {
    this.#programs.setAudibility(change);
  }

  schedule(cues: readonly LightCue[], timeline: LightTimeline): void {
    this.#clock.add(timeline);
    this.#cues.add(cues);
  }

  /** Forget cues older than KEEP_SECONDS before t. */
  prune(t: number): void {
    this.#cues.prune(t);
  }

  clear(): void {
    this.#programs.clear();
    this.#cues.clear();
    this.#clock.clear();
    this.#budget.clear();
  }

  composeAt(t: number, isReduced: boolean, detail: CompositionDetail = "full"): Composition {
    const beatSeconds = this.#clock.timelineAt(t).secondsPerBar / 4;
    const current = this.#programs.programAt(t, beatSeconds);
    if (current === null) return EMPTY_COMPOSITION;
    const { program, leaving } = current;
    const lit = this.#programs.litTracks(program, t, beatSeconds);
    const drawn = this.#trackPrimitives(program, lit, t, isReduced, detail, true);
    const outgoing = leaving === null ? null : this.#trackPrimitives(leaving.program, this.#programs.litTracks(leaving.program, t, beatSeconds), t, isReduced, detail, false, leaving.gain);
    const primitives = capAreas([...drawn.primitives, ...(outgoing?.primitives ?? [])]).slice(0, MAX_PRIMITIVES);
    return {
      primitives,
      paletteShift: sectionHueShift(program.lightSourceHash, this.#clock.sectionAt(t)),
      coreX: program.coreX,
      stagePlanHash: program.stagePlanHash,
      lightTracks: drawn.lightTracks,
      sky: drawn.sky,
      flow: isReduced ? 0 : this.#clock.beatAt(t) * FLOW_PER_BEAT,
    };
  }

  /** Primitives of the lit tracks, strongest priority first; a leaving program is drawn full, outside the budget. */
  #trackPrimitives(program: LightProgram, lit: readonly LitTrack[], t: number, isReduced: boolean, detail: CompositionDetail, isBudgeted: boolean, gain = 1) {
    const scenes = scenesOf(program);
    const audible = lit.flatMap((entry) => scenes.get(entry.track) ?? []);
    const bar = isBudgeted ? this.#allocations(program, audible, t) : null;
    const versions = bar?.now ?? new Map<string, Version>();
    const exposure = bar === null ? new Map<string, number>() : exposureOf(audible, bar);
    const priorities = new Map(lit.map((entry) => [entry.track, priorityOf(scenes.get(entry.track), versions)]));
    const ordered = [...lit].sort((a, b) => (priorities.get(b.track) ?? 0) - (priorities.get(a.track) ?? 0));
    const motion = { isReduced, beat: this.#clock.beatAt(t) };
    const primitives: ScenePrimitive[] = [];
    const lightTracks: string[] = [];
    for (const entry of ordered) {
      const description = scenes.get(entry.track);
      const anchor = program.anchors.get(entry.track);
      if (description === undefined || anchor === undefined) continue;
      const version = versions.get(entry.track) ?? { isFull: true, energy: 1 };
      if (!version.isFull) lightTracks.push(entry.track);
      if (!version.isFull && detail === "full-layers-only") continue;
      const scale = entry.gain * gain * (version.isFull ? (exposure.get(description.zone) ?? 1) : 1);
      const alive = this.#cues.between(entry.track, t - LOOK_BACK_S, t);
      for (const cue of isReduced ? mergeCoincident(alive) : alive) {
        for (const primitive of cuePrimitives(description, anchor, cue, t, motion, version)) primitives.push(scale === 1 ? primitive : { ...primitive, intensity: primitive.intensity * scale });
      }
    }
    const skyTracks = lit.flatMap((entry) => {
      const scene = scenes.get(entry.track);
      return scene === undefined ? [] : [{ scene, gain: entry.gain }];
    });
    const phase = { beat: motion.beat, secondsPerBeat: this.#clock.timelineAt(t).secondsPerBar / 4, isReduced };
    const sky = bar === null ? NO_SKY : skyAtmosphere(skyTracks, bar.now, bar.before, bar.sinceStart, phase);
    return { primitives, lightTracks, sky };
  }

  /** This bar's allocation, the bar before's (while the slide runs), and the time since the bar started. */
  #allocations(program: LightProgram, audible: readonly SceneDescription[], t: number): BarAllocations {
    const secondsPerBar = this.#clock.timelineAt(t).secondsPerBar;
    const bar = Math.floor(this.#clock.barAt(t));
    const sinceStart = t - this.#clock.timeOfBar(bar);
    const now = this.#budget.allocate(program, audible, this.#cues, bar, secondsPerBar, t);
    const before = sinceStart < EXPOSURE_SLIDE_S ? this.#budget.allocate(program, audible, this.#cues, bar - 1, secondsPerBar, t) : now;
    return { now, before, sinceStart };
  }
}

interface BarAllocations {
  readonly now: ReadonlyMap<string, Version>;
  readonly before: ReadonlyMap<string, Version>;
  readonly sinceStart: number;
}

/** Per zone, min(1, 1.5 / √n) of its full layers, sliding from the bar before's value. */
function exposureOf(audible: readonly SceneDescription[], bar: BarAllocations): ReadonlyMap<string, number> {
  const full = (allocation: ReadonlyMap<string, Version>) => fullLayersByZone(audible, allocation);
  const now = full(bar.now);
  const before = bar.before === bar.now ? now : full(bar.before);
  const scales = new Map<string, number>();
  for (const scene of audible) scales.set(scene.zone, zoneScaleAt(zoneScale(before.get(scene.zone) ?? 0), zoneScale(now.get(scene.zone) ?? 0), bar.sinceStart));
  return scales;
}

/** A program's scenes by track, built once per program: the composer asks at every instant. */
const scenesByProgram = new WeakMap<LightProgram, ReadonlyMap<string, SceneDescription>>();

function scenesOf(program: LightProgram): ReadonlyMap<string, SceneDescription> {
  const known = scenesByProgram.get(program);
  if (known !== undefined) return known;
  const scenes = new Map(program.scenes.map((scene) => [scene.track, scene]));
  scenesByProgram.set(program, scenes);
  return scenes;
}

/**
 * Full layers per zone of one allocation. The budget cache hands out one map per bar, the
 * audible tracks and the newcomers admitted, so the count is kept with the map it came from.
 */
const fullByAllocation = new WeakMap<ReadonlyMap<string, Version>, { readonly audible: readonly string[]; readonly counts: ReadonlyMap<SceneZone, number> }>();

function fullLayersByZone(audible: readonly SceneDescription[], allocation: ReadonlyMap<string, Version>): ReadonlyMap<SceneZone, number> {
  const known = fullByAllocation.get(allocation);
  if (known !== undefined && known.audible.length === audible.length && known.audible.every((track, index) => audible[index]?.track === track)) return known.counts;
  const counts = countByZone(audible.filter((scene) => allocation.get(scene.track)?.isFull !== false).map((scene) => scene.zone));
  fullByAllocation.set(allocation, { audible: audible.map((scene) => scene.track), counts });
  return counts;
}

function priorityOf(scene: SceneDescription | undefined, versions: ReadonlyMap<string, Version>): number {
  if (scene === undefined) return 0;
  const version = versions.get(scene.track);
  return FAMILY_WEIGHT[scene.family] * (version?.energy ?? 1) + (version?.isFull === false ? 0 : 10);
}
