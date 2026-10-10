// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The closed set of demo actions. Each
// action is one gesture a person makes in the app. Text actions change the source through
// a minimal edit of @untzel/language; transport actions only start or switch playback.

/** Where a layer sits in a producer's building order. */
export type LayerRole =
  | "setup"
  | "kick"
  | "bass"
  | "percussion"
  | "harmony"
  | "melody"
  | "voice"
  | "fx"
  /** The tracks outside the featured ones, typed in the Code panel line by line. */
  | "band"
  /** Kick and percussion muted, two bars of listening before the Drop. */
  | "breakdown"
  /** The Drop, then the mutes the template itself asks for. */
  | "drop"
  | "arrangement";

/** Why a step has to be typed in the Code panel: no edit function writes it yet. */
export type CodeReason =
  /** A track outside the featured layers: its whole line, in bursts. */
  | "band"
  | "global"
  | "section"
  | "song"
  | "signal-value"
  | "named-value"
  | "flag"
  | "precision"
  | "chord"
  | "group"
  | "sustain"
  | "accent"
  | "probability"
  | "repeat"
  | "pitched-hit"
  | "drum-note"
  | "step-count"
  | "mixed-step-counts"
  | "no-pattern";

/**
 * How typed code appears: key by key at reading speed, or in bursts of a few words, each
 * readable on screen, for the lines of the band and the arrangement.
 */
export type TypingPace = "keys" | "bursts";

/** Where typed text goes, resolved against the text at the moment it is typed. */
export type CodePlacement =
  /** A new line at the end of the text. */
  | { readonly kind: "appendLine" }
  /** Appended to the end of the track statement, before any comment. */
  | { readonly kind: "trackEnd"; readonly track: string }
  /** Replaces the whole pattern of the track. */
  | { readonly kind: "trackPattern"; readonly track: string };

export type DemoAction =
  | { readonly kind: "addTrack"; readonly instrument: string; readonly track: string; readonly preset: string | null }
  | { readonly kind: "renameTrack"; readonly track: string; readonly newName: string }
  | { readonly kind: "setStepCount"; readonly track: string; readonly count: number; readonly hold: boolean }
  | { readonly kind: "setTrackBars"; readonly track: string; readonly bars: number }
  | { readonly kind: "toggleStep"; readonly track: string; readonly bar: number; readonly step: number }
  | { readonly kind: "setStepNote"; readonly track: string; readonly bar: number; readonly step: number; readonly note: string }
  | { readonly kind: "setParameter"; readonly track: string; readonly parameter: string; readonly value: number }
  | { readonly kind: "setMute"; readonly track: string; readonly muted: boolean }
  | { readonly kind: "setLoopBars"; readonly bars: number }
  | { readonly kind: "addSectionMember"; readonly section: string; readonly track: string }
  | { readonly kind: "typeCode"; readonly placement: CodePlacement; readonly text: string; readonly reason: CodeReason; readonly pace: TypingPace }
  | { readonly kind: "togglePlay" }
  | { readonly kind: "setMode"; readonly mode: "loop" | "song" }
  /** The transport's Drop button: every mute goes, in one edit (dropEdit). */
  | { readonly kind: "drop" };

export type DemoActionKind = DemoAction["kind"];

/** One layer of the build: a track, the setup or the arrangement. */
export interface DemoLayer {
  readonly name: string;
  readonly role: LayerRole;
  readonly actions: readonly DemoAction[];
}

/** The whole build of a template, in producer order. */
export interface DemoScript {
  readonly layers: readonly DemoLayer[];
}

/** The ordered list of actions of a script. */
export function demoActions(script: DemoScript): readonly DemoAction[] {
  return script.layers.flatMap((layer) => layer.actions);
}
