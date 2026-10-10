// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneDescription, SceneZone } from "@untzel/scene";
import { LARGE_AREA_ATTACK_S } from "../families/family-context";
import type { Version } from "./scene-budget";
import { EXPOSURE_SLIDE_S } from "./zone-exposure";
// The sky's atmosphere in an exported frame: a file has
// no top bar, so the band the page gives its chrome carries a haze in the colour of the
// strongest sky track. Its level follows the sky's energy of the bar before, the same number
// the budget decides with, and slides over 0.35 s at a bar start. On top of it the haze
// breathes on the beat with the pulse of the groove (the core and the ground): it rises over
// SKY_BREATH_RISE_S, never faster than the large-area rule, and falls back by the next beat.
// The limiter meters the breath as transient light (luminance.ts). Pure; the page never
// draws the haze (KeepOut.frameHasChrome).

/** The haze at a full sky: bright enough to read as light (linear Y ≈ 0.2 over the stage). */
export const SKY_ATMOSPHERE_GAIN = 0.55;
/** The breath's peak over the level, at a full groove. */
export const SKY_BREATH_DEPTH = 0.5;
/** The haze lights more than a quarter of a story frame: it rises at least LARGE_AREA_ATTACK_S. */
export const SKY_BREATH_RISE_S = Math.max(0.15, LARGE_AREA_ATTACK_S);
/** The zones whose energy drives the breath: the kick's rings and the floor's light. */
const PULSE_ZONES: ReadonlySet<SceneZone> = new Set(["core", "ground"]);

export interface SkyAtmosphere {
  /** 0..SKY_ATMOSPHERE_GAIN: the steady haze. */
  readonly level: number;
  /** 0..SKY_BREATH_DEPTH: the beat's share on top, so the haze is level × (1 + breath). */
  readonly breath: number;
  /** The palette slot of the strongest sky track. */
  readonly color: number;
}

export const NO_SKY: SkyAtmosphere = { level: 0, breath: 0, color: 0 };

export interface SkyTrack {
  readonly scene: SceneDescription;
  /** The track's audibility ramp, 0..1. */
  readonly gain: number;
}

/** Where the haze is inside one beat. */
export interface BeatPhase {
  /** Beats since play. */
  readonly beat: number;
  readonly secondsPerBeat: number;
  readonly isReduced: boolean;
}

function zoneEnergy(tracks: readonly SkyTrack[], versions: ReadonlyMap<string, Version>, isIn: (zone: SceneZone) => boolean): number {
  return tracks.reduce((total, { scene, gain }) => total + (isIn(scene.zone) ? (versions.get(scene.track)?.energy ?? 0) * gain : 0), 0);
}

/** The sky's level for one bar's allocation. */
export function skyLevel(tracks: readonly SkyTrack[], versions: ReadonlyMap<string, Version>): number {
  return SKY_ATMOSPHERE_GAIN * Math.min(1, zoneEnergy(tracks, versions, (zone) => zone === "sky"));
}

/**
 * 0..1 over one beat: a smooth rise over SKY_BREATH_RISE_S from the beat, then a cosine fall
 * that reaches 0 at the next beat, so the curve is continuous across beats.
 */
export function breathAt(phase: BeatPhase): number {
  if (phase.isReduced || phase.secondsPerBeat <= 0) return 0;
  const age = (phase.beat - Math.floor(phase.beat)) * phase.secondsPerBeat;
  const rise = Math.min(SKY_BREATH_RISE_S, phase.secondsPerBeat / 2);
  if (age < rise) {
    const x = age / rise;
    return x * x * (3 - 2 * x);
  }
  return 0.5 + 0.5 * Math.cos((Math.PI * (age - rise)) / (phase.secondsPerBeat - rise));
}

/** From the bar before's level to this bar's over EXPOSURE_SLIDE_S; the colour of the strongest sky track now. */
export function skyAtmosphere(tracks: readonly SkyTrack[], now: ReadonlyMap<string, Version>, before: ReadonlyMap<string, Version>, sinceBarStart: number, phase: BeatPhase): SkyAtmosphere {
  const sky = tracks.filter(({ scene }) => scene.zone === "sky");
  if (sky.length === 0) return NO_SKY;
  const strength = (track: SkyTrack): number => (now.get(track.scene.track)?.energy ?? 0) * track.gain;
  const strongest = [...sky].sort((a, b) => strength(b) - strength(a) || a.scene.lookSeed - b.scene.lookSeed)[0];
  const share = Math.min(1, Math.max(0, sinceBarStart / EXPOSURE_SLIDE_S));
  const level = skyLevel(sky, before) + (skyLevel(sky, now) - skyLevel(sky, before)) * share;
  const groove = Math.min(1, zoneEnergy(tracks, now, (zone) => PULSE_ZONES.has(zone)));
  return { level, breath: SKY_BREATH_DEPTH * groove * breathAt(phase), color: strongest?.scene.colorIndex ?? 0 };
}
