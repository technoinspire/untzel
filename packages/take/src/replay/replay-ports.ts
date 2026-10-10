// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the replay uses, by structure: the take never imports the transport, the language
// nor the export; the composition hands them in.
import type { Program } from "@untzel/core";
import type { BeatGrid, PlaybackMode, PlayRangeChange, SoundingRecipe } from "@untzel/session";

/** What the replay uses from the transport; the real Transport satisfies it by structure. */
export interface ReplayTransport {
  setProgram(program: Program): void;
  play(mode: PlaybackMode, options?: { readonly startBar?: number }): unknown;
  setMode(mode: PlaybackMode): unknown;
  stop(): void;
  setPlayRange(change: PlayRangeChange): void;
  setBackground(isHidden: boolean): void;
  scheduleUntil(frame: number): void;
  scheduledUntil(): number | null;
  beatGrid(): BeatGrid | null;
}

/** The audition (@untzel/transport's PreviewTransport), demo only. */
export interface ReplayPreview {
  start(program: Program, grid: BeatGrid | null): boolean;
  note(program: Program, midis: readonly number[], seconds: number): boolean;
  stop(): void;
  tick(): void;
}

/** The clock the replay moves; the transport's ClockPort reads `frame`. */
export interface ReplayClock {
  readonly sampleRate: number;
  frame: number;
}

/** Text → Program through the composition: analyze + soundingProgram. */
export type Materialize = (recipe: SoundingRecipe) => Program;

/** How far ahead of the quantum being rendered the replay applies entries and schedules. */
export const REPLAY_AHEAD_SECONDS = 0.12;

export interface TakeReplayParts {
  readonly transport: ReplayTransport;
  readonly preview: ReplayPreview | null;
  readonly clock: ReplayClock;
  readonly materialize: Materialize;
  /**
   * The transport's longest lookahead (@untzel/transport's BACKGROUND_LOOKAHEAD_SECONDS, 2 s):
   * live, a song can end up to this far before its end sounds. The composition passes it,
   * because take never imports transport.
   */
  readonly maxLookaheadSeconds: number;
}
