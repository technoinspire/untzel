// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range: the range row and ruler of the transport.
import type { PlaybackMode, RangePartNames } from "@untzel/session";

/** A play range, 1-based and inclusive. */
export interface PlayRangeValue {
  readonly startBar: number;
  readonly endBar: number;
  /** Song mode: repeats (true) or plays on into the song (false). */
  readonly cycle: boolean;
}

/** A part of the song on the range ruler, 1-based and inclusive. */
export interface RulerPartView {
  readonly name: string;
  readonly startBar: number;
  readonly endBar: number;
}

/** The play range row and ruler of the transport. */
export interface PlayRangeView {
  /** The ruler being edited: the mode asked for. */
  readonly mode: PlaybackMode;
  /** Bars of that ruler; 0 when there is nothing to range (song mode without parts). */
  readonly lastBar: number;
  readonly range: PlayRangeValue | null;
  /** The range of the mode that sounds, for the transport label. */
  readonly sounding: PlayRangeValue | null;
  /** 1-based ruler bar sounding now, when the ruler's mode sounds; null otherwise. */
  readonly playheadBar: number | null;
  /** Song mode: the parts along the ruler. */
  readonly parts: readonly RulerPartView[];
  /** The parts at the ends of the song range when both fall on part boundaries. */
  readonly songNames: RangePartNames | null;
}
