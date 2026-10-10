// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneAnchor, SceneDescription } from "@untzel/scene";
import { eventRandom } from "@untzel/scene";
import type { LightCue } from "../ports";
import type { Area, AreaKind, Figure, FigureKind } from "../composer/scene-primitive";
import { toneAt } from "../cues/tone-motion";
import { envelope, trapezoid, REDUCED_RAMP_S } from "./envelope";
// What every family function reads about one pulse at one instant. Families
// are pure: (description, anchor, cue, now, motion) → primitives in u. Nothing random:
// per-event draws come from eventRandom(sceneSeed, bar, tick, salt).

export interface Motion {
  readonly isReduced: boolean;
  /** Beats since play, from the music's clock. */
  readonly beat: number;
}

/** Any primitive lighting more than a quarter of the stage ramps in over this. */
export const LARGE_AREA_ATTACK_S = 0.12;
/** Flow-noise time per beat: fog and ribbons drift one lattice cell in about 8 bars. */
export const FLOW_PER_BEAT = 0.03;

export interface Pulse {
  readonly description: SceneDescription;
  readonly anchor: SceneAnchor;
  readonly cue: LightCue;
  /** Seconds since the cue's start. */
  readonly age: number;
  readonly life: number;
  /** age / life, 0..1. */
  readonly t: number;
  readonly isReduced: boolean;
  /** A-S-R level (reduced motion: the trapezoid). */
  readonly level: number;
  /** 0..1 pitch: notes over the manifest's range, hits by their tune. */
  readonly pitch: number;
  /** The tone the DSP produces now (cutoff), 0..1. */
  readonly tone: number;
  /** 0..1 growth over the life (reduced motion: held at the middle). */
  readonly grow: number;
  readonly beat: number;
  readonly flow: number;
  /** 0..1 rise of a large primitive. */
  readonly ramp: number;
  /** The plan's scale, at most 1.15. */
  readonly scale: number;
  /** The value the manifest's drive reads. */
  readonly drive: number;
}

export function pulseAt(description: SceneDescription, anchor: SceneAnchor, cue: LightCue, now: number, life: number, motion: Motion): Pulse | null {
  const age = now - cue.audioTime;
  const isReduced = motion.isReduced;
  if (age < 0 || age > life + (isReduced ? REDUCED_RAMP_S : 0)) return null;
  const t = Math.min(1, age / life);
  const level = isReduced ? trapezoid(age, life) : envelope(age, cue.attack, cue.duration, cue.release);
  const pitch = pitchOf(description, cue);
  const tone = toneAt(cue, age);
  const flow = isReduced ? 0 : motion.beat * FLOW_PER_BEAT;
  const drive = { pitch, cutoff: tone, envelope: level, attack: cue.velocity, velocity: cue.velocity }[description.drive];
  return {
    description,
    anchor,
    cue,
    age,
    life,
    t,
    isReduced,
    level,
    pitch,
    tone,
    grow: isReduced ? 0.5 : 1 - (1 - t) ** 3,
    beat: isReduced ? 0 : motion.beat,
    flow,
    ramp: isReduced ? 1 : Math.min(1, age / LARGE_AREA_ATTACK_S),
    scale: Math.min(1.15, anchor.scale),
    drive,
  };
}

/** (1 − t)^power; the trapezoid under reduced motion. */
export function fade(pulse: Pulse, power: number): number {
  return pulse.isReduced ? trapezoid(pulse.age, pulse.life) : (1 - pulse.t) ** power;
}

export function pitchOf(description: SceneDescription, cue: LightCue): number {
  if (cue.pitches.length === 0) return cue.tunePosition ?? 0.5;
  const { lowest, highest } = description.pitchRange;
  const mean = cue.pitches.reduce((sum, midi) => sum + midi, 0) / cue.pitches.length;
  return Math.min(1, Math.max(0, (mean - lowest) / Math.max(1, highest - lowest)));
}

export function drawsOf(pulse: Pulse, salt: number): () => number {
  return eventRandom(pulse.description.sceneSeed, pulse.cue.bar, pulse.cue.tick, salt);
}

/** The geometry a family decides; colour, seed, zone and flow come from the pulse. */
export interface Shape {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly intensity: number;
  readonly width?: number;
  readonly aspect?: number;
  readonly rotation?: number;
  readonly extra?: number;
  readonly whiteCore?: boolean;
}

// Built field by field, not by spreading the shape: the composer builds these for every
// alive cue at every instant it composes (about 230 times a second on the stage), and the
// spread was the largest single cost of a composition. Same fields, same values.
export function figure(pulse: Pulse, kind: FigureKind, shape: Shape): Figure {
  return {
    layer: "figure",
    kind,
    x: shape.x,
    y: shape.y,
    size: shape.size,
    intensity: shape.intensity,
    width: shape.width ?? 0,
    aspect: shape.aspect ?? 1,
    rotation: shape.rotation ?? 0,
    extra: shape.extra ?? 0,
    color: pulse.description.colorIndex,
    whiteCore: shape.whiteCore ?? pulse.description.tint === "track-white-core",
    flow: pulse.flow,
    seed: pulse.description.lookSeed,
    zone: pulse.description.zone,
    isTransient: true,
  };
}

export function area(pulse: Pulse, kind: AreaKind, shape: Shape): Area {
  return {
    layer: "area",
    kind,
    x: shape.x,
    y: shape.y,
    size: shape.size,
    intensity: shape.intensity,
    width: shape.width ?? 0,
    aspect: shape.aspect ?? 1,
    rotation: shape.rotation ?? 0,
    extra: shape.extra ?? 0,
    color: pulse.description.colorIndex,
    whiteCore: false,
    flow: pulse.flow,
    seed: pulse.description.lookSeed,
    zone: pulse.description.zone,
    isTransient: true,
  };
}

/** A core figure's radius plus its stroke never passes its band's outer edge. */
export function withinBand(figureValue: Figure, anchor: SceneAnchor): Figure {
  if (anchor.band === null) return figureValue;
  return { ...figureValue, size: Math.max(0, Math.min(figureValue.size, anchor.band.to - figureValue.width)) };
}
