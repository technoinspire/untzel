// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { screenKeepOut, type KeepOut, type SceneManifest } from "@untzel/scene";
import { buildLightProgram, type LightCue, type LightProgram, type LightTimeline } from "@untzel/light";
// The preview's light without the real engine: the fake session's tracks become a light
// program and its steps become cues, so the preview shows the scene pipeline. Every
// instrument draws its category's default scene: the preview carries no manifests.

const GROUP_OF: Readonly<Record<string, string>> = {
  kick: "drums",
  snare: "drums",
  clap: "drums",
  hat: "drums",
  perc: "drums",
  bass: "bass",
  sub: "bass",
  acid: "leads",
  lead: "leads",
  pad: "pads",
  stab: "pads",
  piano: "keys",
  vox: "voices",
  noise: "fx",
};

/** No brand zones: the preview has no export, so only the top bar's band stays dark. */
export const PREVIEW_KEEP_OUT: KeepOut = screenKeepOut([]);

export interface PreviewTrack {
  readonly name: string;
  readonly instrument: string;
  readonly pan: number;
}

export function previewProgram(tracks: readonly PreviewTrack[]): LightProgram {
  const manifestOf = (instrument: string): SceneManifest => ({ name: instrument, group: GROUP_OF[instrument] ?? "drums", scene: null, tone: [], range: null });
  return buildLightProgram(
    { audioTime: 0, tracks: tracks.map((track) => ({ ...track, isAudible: true })), lightSourceHash: 0x0b0a, stagePlanHash: 0x0b0a },
    manifestOf,
    PREVIEW_KEEP_OUT,
  );
}

export function previewTimeline(now: number, barSeconds: number): LightTimeline {
  const bar = Math.floor(now / barSeconds);
  return { audioTime: bar * barSeconds, bar, secondsPerBar: barSeconds, section: null };
}

export interface PreviewStep {
  readonly track: string;
  readonly audioTime: number;
  readonly duration: number;
  readonly isAccent: boolean;
  readonly tone: number;
}

export function previewCue(step: PreviewStep, barSeconds: number): LightCue {
  const bars = step.audioTime / barSeconds;
  return {
    track: step.track,
    audioTime: step.audioTime,
    duration: step.duration,
    velocity: step.isAccent ? 1 : 0.85,
    isAccent: step.isAccent,
    tone: step.tone,
    toneMotion: null,
    pitches: [],
    tunePosition: null,
    attack: 0.005,
    release: 0.2,
    bar: Math.floor(bars),
    tick: Math.min(95, Math.floor((bars - Math.floor(bars)) * 96)),
    section: null,
  };
}
