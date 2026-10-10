// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// LightPort and what crosses it. LightPort belongs with the ports of @untzel/session; it
// lives here for now (same shape: once it moves, this file re-exports it).
import type { Curve } from "@untzel/core";
import type { KeepOut, SceneAnchor, SceneDescription } from "@untzel/scene";

/**
 * idle: slow fog, no peaks (the waiting screen). live: cues drive the scene. off: the static stage
 * colour, no light (load error, unsupported browser).
 */
export type StageMode = "idle" | "live" | "off";

/** How a DSP modulator's value on tone[0] becomes the cue's 0..1 tone. */
export interface ToneMapping {
  readonly curve: Curve;
  readonly from: number;
  readonly to: number;
}

/** The DSP modulator on tone[0], in DSP units: the tone the light reads follows it over the cue's life. */
export type ToneMotion =
  | {
      readonly kind: "lfo";
      readonly shape: number;
      readonly curve: number;
      readonly low: number;
      readonly high: number;
      readonly periodSeconds: number;
      /** 0..1, the LFO's phase at the event. */
      readonly phaseAtEvent: number;
      readonly mapping: ToneMapping;
    }
  | {
      readonly kind: "envelope";
      readonly curve: number;
      readonly low: number;
      readonly high: number;
      readonly seconds: number;
      readonly mapping: ToneMapping;
    };

export interface LightCue {
  /** Track name: one scene per name. */
  readonly track: string;
  /** AudioContext time at which the event's sound starts (before output latency). */
  readonly audioTime: number;
  /** Seconds. */
  readonly duration: number;
  /** 0..1. */
  readonly velocity: number;
  readonly isAccent: boolean;
  /** 0..1, tone[0] at the event. */
  readonly tone: number;
  /** Null: the tone holds still over the cue's life. */
  readonly toneMotion: ToneMotion | null;
  /** Raw MIDI of the event, at most 8; empty for a hit. */
  readonly pitches: readonly number[];
  /** 0..1 for a hit with a tune or pitch parameter; null otherwise. */
  readonly tunePosition: number | null;
  /** Seconds. */
  readonly attack: number;
  readonly release: number;
  /** Bar since play: the index of the event draw. */
  readonly bar: number;
  /** 0..95 inside the bar. */
  readonly tick: number;
  readonly section: string | null;
}

/** Where the music stands at a bar boundary: the light's musical clock. */
export interface LightTimeline {
  /** position.frame / sampleRate: the bar boundary's audio time. */
  readonly audioTime: number;
  readonly bar: number;
  readonly secondsPerBar: number;
  readonly section: string | null;
}

/** A program's scenes, placed once: mute and solo only change `audible`. */
export interface LightProgram {
  /** atFrame / sampleRate: when it takes effect. */
  readonly audioTime: number;
  /** Every track of the program, audible or not. */
  readonly scenes: readonly SceneDescription[];
  readonly anchors: ReadonlyMap<string, SceneAnchor>;
  readonly audible: ReadonlySet<string>;
  readonly lightSourceHash: number;
  readonly stagePlanHash: number;
  /** The core's centre, in u: the feedback trail contracts towards it. */
  readonly coreX: number;
}

export interface AudibilityChange {
  readonly audioTime: number;
  readonly audible: ReadonlySet<string>;
}

export interface LightPort {
  setProgram(program: LightProgram): void;
  setAudibility(change: AudibilityChange): void;
  schedule(cues: readonly LightCue[], timeline: LightTimeline): void;
  setMode(mode: StageMode): void;
}

/**
 * One still of the scene being heard, drawn through the same FrameDriver and renderer at
 * a file's size and keep-out: the Export sheet's preview shows what the file will hold.
 * Null when the stage has no renderer yet.
 */
export interface SceneStills {
  still(size: { readonly width: number; readonly height: number }, keepOut: KeepOut): Promise<Blob | null>;
}

/** The clock the stage compares cues against: the time being heard right now. */
export interface HeardClock {
  /** AudioContext time currently leaving the speaker, in seconds. */
  heardTime(): number;
}
