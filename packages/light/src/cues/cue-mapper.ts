// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { GeneralParameter, type InstrumentRegistry } from "@untzel/core";
import type { KeepOut } from "@untzel/scene";
import type { ProgramActivation, ScheduledBatch } from "@untzel/session";
import { audibleAfterPoint, isAudibleSound, trackSound, type TrackSound } from "./audibility";
import { cueOf } from "./event-cue";
import { ParameterPoints } from "./cue-tone";
import { buildLightProgram } from "./light-program";
import type { AudibilityChange, LightCue, LightProgram, LightTimeline } from "../ports";
import { KEPT_GENERATIONS, TrackRevisions } from "./track-revisions";
// Scheduled events → the light. The
// events the worklet plays drive the stage; no audio analysis decides the light. The live
// page and the export worker each run one, so both draw the same light.

export interface MappedBatch {
  readonly cues: readonly LightCue[];
  readonly timeline: LightTimeline;
  /** Solo and gain points that changed which tracks sound, in time order. */
  readonly audibility: readonly AudibilityChange[];
}

export class LightCueMapper {
  readonly #registry: InstrumentRegistry;
  readonly #keepOut: KeepOut;
  readonly #revisions = new TrackRevisions();
  readonly #points = new ParameterPoints();
  readonly #sounds = new Map<number, TrackSound[]>();
  #program: LightProgram | null = null;
  #section: string | null = null;

  constructor(registry: InstrumentRegistry, keepOut: KeepOut) {
    this.#registry = registry;
    this.#keepOut = keepOut;
  }

  /** A new generation gives a program; a re-sent one only a change of audibility, or nothing. */
  activate(activation: ProgramActivation, sampleRate: number): LightProgram | AudibilityChange | null {
    const isResent = this.#revisions.add(activation);
    this.#points.forget(activation.generation - KEPT_GENERATIONS);
    for (const generation of this.#sounds.keys()) if (!this.#revisions.has(generation)) this.#sounds.delete(generation);
    const before = this.#audible(activation.generation);
    this.#sounds.set(activation.generation, activation.tracks.map(trackSound));
    const audioTime = activation.atFrame / sampleRate;
    if (isResent) return sameSet(before, this.#audible(activation.generation)) ? null : { audioTime, audible: this.#audible(activation.generation) };
    this.#program = buildLightProgram(
      {
        audioTime,
        tracks: activation.tracks.map((track) => ({ name: track.name, instrument: track.instrument, pan: track.parameters[GeneralParameter.pan] ?? 0, isAudible: track.isAudible })),
        lightSourceHash: activation.lightSourceHash,
        stagePlanHash: activation.stagePlanHash,
      },
      (instrument) => this.#registry.get(instrument),
      this.#keepOut,
    );
    return this.#program;
  }

  /** A frame f sounds at AudioContext time f / sampleRate. */
  cues(batch: ScheduledBatch, sampleRate: number): MappedBatch {
    const { position } = batch;
    const audibility = this.#applyPoints(batch, sampleRate);
    const cues: LightCue[] = [];
    for (const event of batch.events) {
      const track = this.#revisions.trackAt(event.generation, event.trackIndex, event.frame);
      const manifest = track === undefined ? undefined : this.#registry.get(track.instrument);
      if (track === undefined || manifest === undefined) continue;
      const section = event.frame >= position.frame ? position.section : this.#section;
      cues.push(cueOf({ event, track, manifest, position, section, sampleRate, points: this.#points }));
    }
    this.#section = position.section;
    const timeline: LightTimeline = { audioTime: position.frame / sampleRate, bar: position.bar, secondsPerBar: position.framesPerBar / sampleRate, section: position.section };
    return { cues, timeline, audibility };
  }

  #applyPoints(batch: ScheduledBatch, sampleRate: number): AudibilityChange[] {
    this.#points.add(batch.parameters);
    const changes: AudibilityChange[] = [];
    const ordered = [...batch.parameters].sort((a, b) => a.frame - b.frame);
    for (const point of ordered) {
      const sounds = this.#sounds.get(point.generation);
      const sound = sounds?.[point.trackIndex];
      if (sounds === undefined || sound === undefined) continue;
      const before = this.#audible(point.generation);
      sounds[point.trackIndex] = audibleAfterPoint(sound, point);
      const after = this.#audible(point.generation);
      if (!sameSet(before, after)) changes.push({ audioTime: point.frame / sampleRate, audible: after });
    }
    return changes;
  }

  #audible(generation: number): ReadonlySet<string> {
    const sounds = this.#sounds.get(generation) ?? [];
    const activation = this.#revisions.activationAt(generation, Number.POSITIVE_INFINITY);
    return new Set(sounds.flatMap((sound, index) => (isAudibleSound(sound) ? [activation?.tracks[index]?.name ?? ""] : [])));
  }
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((name) => b.has(name));
}
