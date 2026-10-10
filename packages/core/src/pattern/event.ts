// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Rational } from "../time/rational";
import type { TimeSpan } from "../time/time-span";

/** UTF-16 offsets into the source text, half-open. */
export interface SourceRange {
  readonly from: number;
  readonly to: number;
}

export type EventValue =
  | { readonly kind: "hit"; readonly accent: boolean }
  | { readonly kind: "note"; readonly midi: number; readonly writtenMidi: number }
  | { readonly kind: "chord"; readonly midis: readonly number[] };

export interface Event {
  /** Track name: the instance identity. */
  readonly track: string;
  /** Onset, absolute bars. */
  readonly begin: Rational;
  /** Includes "~" sustains. */
  readonly duration: Rational;
  readonly value: EventValue;
  /** 0..1: "X" = 1, "x" = 0.8, notes and chords = 0.8. */
  readonly velocity: number;
  readonly source: SourceRange;
}

/**
 * An event belongs to the query whose span contains its begin, so
 * query([a,b)) ++ query([b,c)) = query([a,c)).
 */
export interface Pattern {
  /**
   * `cycleOrigin` (whole bars, default 0) is where the pattern cycle starts: the start
   * of the current part in song mode.
   */
  query(span: TimeSpan, cycleOrigin?: Rational): readonly Event[];
}
