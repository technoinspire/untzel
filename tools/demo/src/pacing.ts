// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { DemoAction, DemoActionKind, DemoScript, LayerRole, TypingPace } from "./actions";
import type { PacingOverrides } from "./demo-file";

// Human pacing of a demo script. Gestures take the
// seconds a person needs to see and do them; the music keeps its tempo. Every layer
// starts on a bar line, its edits enter on the next bar line, and the music plays for a
// few bars before the next layer starts. Pure: positions in beats, from beat 0.

/** Untzel bars are 4/4: four beats of four steps. */
export const BEATS_PER_BAR = 4;

/**
 * Seconds each gesture takes by default: cursor travel, the tap, and a short look. Measured
 * against the recorder's real gestures: Add track takes
 * about 2 s, a note 0.7 to 1 s, a fader 0.2 to 1.8 s; the rest is the look.
 */
export const DEFAULT_GESTURE_SECONDS: Readonly<Record<DemoActionKind, number>> = {
  addTrack: 4,
  renameTrack: 2,
  setStepCount: 1,
  setTrackBars: 1,
  toggleStep: 0.4,
  setStepNote: 0.9,
  setParameter: 1,
  setMute: 0.8,
  setLoopBars: 1.5,
  addSectionMember: 0.8,
  typeCode: 1,
  togglePlay: 1,
  setMode: 1.5,
  drop: 1,
};
/** A line typed in bursts goes to the panel already open: a short look, then the text. */
export const BURST_LINE_SECONDS = 0.3;

/** The breakdown before the Drop always listens this long, unless its layer says otherwise. */
export const BREAKDOWN_LISTEN_BARS = 2;

export const DEFAULT_PACING = {
  introBars: 1,
  listenBars: 1,
  /** The finished song in Song mode, the Song view on screen. */
  outroBars: 6,
  typingCharsPerSecond: 12,
  /** The band's lines, the arrangement and whole patterns appear a few words at a time. */
  burstCharsPerSecond: 120,
} as const;

export interface TimedAction {
  readonly action: DemoAction;
  /** Index in Timeline.layers (a track may be called "setup"). */
  readonly layer: number;
  readonly startBeat: number;
  readonly beats: number;
}

export interface TimedLayer {
  readonly name: string;
  readonly role: LayerRole;
  /** Always on a bar line. */
  readonly startBeat: number;
  /** The bar line after its last gesture: when the layer is heard. */
  readonly entersBeat: number;
  /** When the next layer may start. */
  readonly endBeat: number;
}

export interface Timeline {
  readonly tempo: number;
  readonly actions: readonly TimedAction[];
  readonly layers: readonly TimedLayer[];
  readonly totalBeats: number;
  readonly totalSeconds: number;
}

/** 1-based bar and beat of a position, as a musician counts them. */
export function barAndBeat(beat: number): { readonly bar: number; readonly beat: number } {
  const bar = Math.floor(beat / BEATS_PER_BAR);
  return { bar: bar + 1, beat: beat - bar * BEATS_PER_BAR + 1 };
}

function nextBarLine(beat: number): number {
  // A hair of tolerance so float sums that land on a bar line stay there.
  return Math.ceil(beat / BEATS_PER_BAR - 1e-9) * BEATS_PER_BAR;
}

/** How fast typed code appears at `pace`, with the demo file's overrides. */
export function charsPerSecondOf(pace: TypingPace, overrides: PacingOverrides): number {
  return pace === "bursts"
    ? (overrides.burstCharsPerSecond ?? DEFAULT_PACING.burstCharsPerSecond)
    : (overrides.typingCharsPerSecond ?? DEFAULT_PACING.typingCharsPerSecond);
}

/** Seconds of one gesture; typing grows with the text. */
function gestureSeconds(action: DemoAction, overrides: PacingOverrides): number {
  const base = overrides.gestureSeconds?.[action.kind] ?? DEFAULT_GESTURE_SECONDS[action.kind];
  if (action.kind !== "typeCode") return base;
  if (action.pace === "bursts") return BURST_LINE_SECONDS + action.text.trim().length / charsPerSecondOf("bursts", overrides);
  return base + action.text.trim().length / charsPerSecondOf(action.pace, overrides);
}

function listenBarsOf(role: LayerRole, overrides: PacingOverrides): number {
  return role === "breakdown" ? BREAKDOWN_LISTEN_BARS : (overrides.listenBars ?? DEFAULT_PACING.listenBars);
}
/** The timeline of `script` at `tempo` bpm, with the demo file's overrides. */
export function planTimeline(script: DemoScript, tempo: number, overrides: PacingOverrides = {}): Timeline {
  if (!Number.isFinite(tempo) || tempo <= 0) throw new RangeError(`tempo must be positive, got ${tempo}`);
  const beatsOf = (seconds: number): number => (seconds * tempo) / 60;
  const actions: TimedAction[] = [];
  const layers: TimedLayer[] = [];
  let cursor = (overrides.introBars ?? DEFAULT_PACING.introBars) * BEATS_PER_BAR;
  for (const [index, layer] of script.layers.entries()) {
    const startBeat = cursor;
    for (const action of layer.actions) {
      const beats = beatsOf(gestureSeconds(action, overrides));
      actions.push({ action, layer: index, startBeat: cursor, beats });
      cursor += beats;
    }
    const entersBeat = nextBarLine(cursor);
    const listenBars = overrides.layers?.[layer.name]?.listenBars ?? listenBarsOf(layer.role, overrides);
    cursor = entersBeat + listenBars * BEATS_PER_BAR;
    layers.push({ name: layer.name, role: layer.role, startBeat, entersBeat, endBeat: cursor });
  }
  const totalBeats = cursor + (overrides.outroBars ?? DEFAULT_PACING.outroBars) * BEATS_PER_BAR;
  return { tempo, actions, layers, totalBeats, totalSeconds: (totalBeats * 60) / tempo };
}
