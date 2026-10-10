// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SourceRange } from "./event";
import type { Key } from "../pitch/pitch";
import type { Rational } from "../time/rational";

// Pure, structured-clone safe data. Produced by @untzel/language, sent to the worker,
// compiled there by compilePattern.

/** One character of a hits token: "." rest, "x" hit, "X" accent, "~" sustain. */
export type HitStep = "rest" | "hit" | "accent" | "sustain";

export type PatternAtom =
  /**
   * A hits token, already expanded: each step occupies one step of the bar.
   * Step i comes from the character at source.from + i. A lone "." is hits ["rest"].
   */
  | { readonly kind: "hits"; readonly steps: readonly HitStep[] }
  /** midi as written (c4 = 60); transpose and key lock are applied by compilePattern. */
  | { readonly kind: "note"; readonly midi: number }
  /** midis as written, lowest first. */
  | { readonly kind: "chord"; readonly midis: readonly number[] }
  /** "c3+eb3+g3": notes as written, in written order; voicing never applies. */
  | { readonly kind: "stack"; readonly midis: readonly number[] }
  /** A lone "~": adds one step to the previous event in the same bar. */
  | { readonly kind: "sustain" }
  /** "[ ... ]": divides the parent step among its elements. */
  | { readonly kind: "group"; readonly elements: readonly PatternElement[] };

export type PatternElement = PatternAtom & {
  /**
   * "!": a hits token accents its last step, a note, stack or chord the event, a group
   * every leaf it plays.
   */
  readonly accent: boolean;
  /** Play probability 0..1, or null when the element has no "?". "?" alone is 0.5. */
  readonly probability: number | null;
  /** "*n" repeats inside the same space; 1 when absent. */
  readonly repeat: number;
  /** Range of the atom only, without the "?" and "*" suffixes. */
  readonly source: SourceRange;
};

export interface PatternBar {
  readonly elements: readonly PatternElement[];
  readonly source: SourceRange;
}

/** A pattern of N bars repeats with an N-bar cycle. */
export interface PatternSpec {
  readonly bars: readonly PatternBar[];
}

/** Everything compilePattern needs besides the spec, already resolved. */
export interface PatternContext {
  readonly trackName: string;
  readonly sourceHash: number;
  readonly key: Key;
  /** True disables the key lock for this track ("free" or "key ... chromatic"). */
  readonly free: boolean;
  /** Semitones, -24..24, applied before the key lock. */
  readonly transpose: number;
  /** Track swing, or the global one when the track has none; 0..1/2. */
  readonly swing: Rational;
  /** Rotation in steps of the first bar; negative rotates backwards. */
  readonly shift: number;
  /** Velocity of "x" and of unaccented notes, 0..1 (0.8 when not written). */
  readonly velocity: number;
  /** Each note lasts until the next written note of the cycle. */
  readonly legato: boolean;
  /** Chord symbols only (never stacks). */
  readonly voicing: Voicing | null;
  readonly inversion: number;
  readonly arp: ArpSpec | null;
}

export type Voicing = "close" | "open" | "spread" | "drop2";
export const VOICINGS: readonly Voicing[] = ["close", "open", "spread", "drop2"];

export type ArpMode = "up" | "down" | "updown" | "random" | "played";
export const ARP_MODES: readonly ArpMode[] = ["up", "down", "updown", "random", "played"];

export interface ArpSpec {
  readonly mode: ArpMode;
  /** Step length in bars (1/16 by default). */
  readonly rate: Rational;
  /** 1..3. */
  readonly octaves: number;
}
