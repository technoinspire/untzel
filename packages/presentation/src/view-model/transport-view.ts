// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport: playing, tempo, key, the bar sounding and the load; and the scale of the key.
import type { ScaleName } from "@untzel/core";
import type { PlaybackMode } from "@untzel/session";

export interface TransportView {
  readonly isPlaying: boolean;
  readonly bpm: number;
  /** For example "c minor". */
  readonly key: string;
  /** The tonic as the text spells it ("c", "f#", "eb") and the scale, for the key picker. */
  readonly keyTonic: string;
  readonly keyScale: ScaleName;
  /** The global `tempo` line, what the tempo editor edits. */
  readonly songTempo: number;
  /** The part playing at its own `| tempo`; null when the song tempo sounds. */
  readonly tempoSetBy: string | null;
  readonly mode: PlaybackMode;
  readonly section: string | null;
  /** 1-based. */
  readonly bar: number | null;
  readonly totalBars: number | null;
  /** Loop length the text asks for, 1..16. */
  readonly loopBars: number;
  /** The text writes `loop <bars>`; false when the length is derived from the patterns. */
  readonly isLoopDeclared: boolean;
  /** Loop mode while playing: 1-based bar of the loop and the length sounding now. */
  readonly loopBar: number | null;
  readonly loopBarsSounding: number | null;
  /** 0..1 progress shown by the transport meter. */
  readonly progress: number;
  /** 0..1 of the way to the next bar boundary. */
  readonly nextBar: number;
  /** 0..1 of the render quantum; null until calibrated. */
  readonly cpu: number | null;
  readonly isDropArmed: boolean;
}

export interface ScaleView {
  readonly label: string;
  /** Pitch classes of the current key, for example ["c", "d", "eb", …]. */
  readonly notes: readonly string[];
}
