// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneManifest } from "@untzel/scene";
import { buildLightProgram, type LightCue, type LightProgram, type LightTimeline } from "@untzel/light/offline";
import { exportKeepOut } from "../brand/brand-exclusion";
// The device probe's busy second of light: a kick every beat at 132 BPM,
// hats between, an acid ribbon and a pad's fog, drawn by the real scene pipeline so the
// pace it measures is the export's.

const BPM = 132;
const SECONDS_PER_BAR = (4 * 60) / BPM;

const MANIFESTS: Readonly<Record<string, SceneManifest>> = {
  kick: { name: "kick", group: "drums", scene: { family: "shockwave", variant: { shape: "triple", density: 2, tint: "track" }, drive: "attack" }, tone: [{ parameter: "decay" }], range: null },
  hat: { name: "hat", group: "drums", scene: { family: "sparks", variant: { shape: "needle", density: 2, tint: "track-white-core" }, drive: "attack" }, tone: [{ parameter: "decay" }], range: null },
  acid: { name: "acid", group: "bass", scene: { family: "ribbon", variant: { shape: "squelch", density: 2, tint: "track" }, drive: "cutoff" }, tone: [{ parameter: "cutoff" }], range: { lowest: 24, highest: 60 } },
  pad: { name: "pad", group: "pads", scene: { family: "fog", variant: { shape: "cloud", density: 2, tint: "track" }, drive: "envelope" }, tone: [{ parameter: "brightness" }], range: { lowest: 36, highest: 84 } },
};

export function probeProgram(): LightProgram {
  const tracks = Object.keys(MANIFESTS).map((name) => ({ name, instrument: name, pan: 0, isAudible: true }));
  return buildLightProgram({ audioTime: 0, tracks, lightSourceHash: 0x5eed, stagePlanHash: 0x5eed }, (name) => MANIFESTS[name], exportKeepOut());
}

export const PROBE_TIMELINE: LightTimeline = { audioTime: 0, bar: 0, secondsPerBar: SECONDS_PER_BAR, section: null };

export function probeCues(): readonly LightCue[] {
  const beat = 60 / BPM;
  const cues: LightCue[] = [];
  for (let index = 0; index * beat < 1; index += 1) {
    const time = index * beat;
    cues.push(cue("kick", time, 0.3), cue("hat", time + beat / 2, 0.1), cue("acid", time + beat / 4, 0.2));
  }
  cues.push(cue("pad", 0, 1.5));
  return cues.filter((item) => item.audioTime < 1);
}

function cue(track: string, audioTime: number, duration: number): LightCue {
  const bar = Math.floor(audioTime / SECONDS_PER_BAR);
  return {
    track,
    audioTime,
    duration,
    velocity: 0.9,
    isAccent: true,
    tone: 0.6,
    toneMotion: null,
    pitches: track === "acid" ? [36] : track === "pad" ? [57, 60, 64] : [],
    tunePosition: null,
    attack: track === "pad" ? 0.2 : 0.005,
    release: 0.3,
    bar,
    tick: Math.floor(((audioTime / SECONDS_PER_BAR) % 1) * 96),
    section: null,
  };
}
