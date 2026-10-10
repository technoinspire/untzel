// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { INSTRUMENT_PARAMETER_OFFSET, curvePosition, type InstrumentManifest } from "@untzel/core";
import type { ActivatedTrack, PlaybackPosition, ScheduledEvent } from "@untzel/session";
import { eventTone, type ParameterPoints } from "./cue-tone";
import type { LightCue } from "../ports";
// One scheduled event as a light cue: its time, velocity, notes or tune, the
// envelope the light shapes it with, its bar and tick (the per-event draw's index, the same
// bar the sound's probability draws count) and the tone the DSP produces.

const MAX_PITCHES = 8;
const TICKS_PER_BAR = 96;
const DEFAULT_ATTACK_S = 0.005;
const DEFAULT_RELEASE_S = 0.1;
const MAX_RELEASE_S = 30;

export interface EventSource {
  readonly event: ScheduledEvent;
  readonly track: ActivatedTrack;
  readonly manifest: InstrumentManifest;
  readonly position: PlaybackPosition;
  readonly section: string | null;
  readonly sampleRate: number;
  readonly points: ParameterPoints;
}

export function cueOf(source: EventSource): LightCue {
  const { event, track, manifest, position, sampleRate } = source;
  const barsAfter = (event.frame - position.frame) / Math.max(1, position.framesPerBar);
  const { tone, toneMotion } = eventTone({ manifest, track, generation: event.generation, trackIndex: event.trackIndex, frame: event.frame, sampleRate, points: source.points });
  return {
    track: track.name,
    audioTime: event.frame / sampleRate,
    duration: event.durationFrames / sampleRate,
    velocity: clamp01(event.velocity, 0.8),
    isAccent: event.value.kind === "hit" && event.value.accent,
    tone,
    toneMotion,
    pitches: event.value.kind === "note" ? [event.value.midi] : event.value.kind === "chord" ? event.value.midis.slice(0, MAX_PITCHES) : [],
    tunePosition: event.value.kind === "hit" ? tunePosition(manifest, track) : null,
    attack: parameter(manifest, track, ["attack"]) ?? DEFAULT_ATTACK_S,
    release: Math.min(MAX_RELEASE_S, Math.max(0, parameter(manifest, track, ["release", "decay", "length"]) ?? DEFAULT_RELEASE_S)),
    bar: position.bar + Math.floor(barsAfter),
    tick: Math.min(TICKS_PER_BAR - 1, Math.floor(TICKS_PER_BAR * (barsAfter - Math.floor(barsAfter)))),
    section: source.section,
  };
}

/** The first of `names` the instrument has, at the activation's value. */
function parameter(manifest: InstrumentManifest, track: ActivatedTrack, names: readonly string[]): number | null {
  for (const name of names) {
    const index = manifest.parameters.findIndex((definition) => definition.name === name);
    const value = index < 0 ? undefined : track.parameters[INSTRUMENT_PARAMETER_OFFSET + index];
    if (value !== undefined && Number.isFinite(value)) return value;
  }
  return null;
}

/** A hit's place on its tune (or pitch, as the kick names it), 0..1; null without one. */
function tunePosition(manifest: InstrumentManifest, track: ActivatedTrack): number | null {
  const index = manifest.parameters.findIndex((definition) => definition.name === "tune" || definition.name === "pitch");
  const definition = manifest.parameters[index];
  const value = track.parameters[INSTRUMENT_PARAMETER_OFFSET + index];
  if (definition === undefined || value === undefined) return null;
  return clamp01(curvePosition(definition.curve, definition.min, definition.max, value), 0.5);
}

function clamp01(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}
