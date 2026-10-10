// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program, Section } from "../program/program";

// Loop length of loop mode.
// Shared by the language (limits), the transport (the cycle) and the session (the view).

export const MIN_LOOP_BARS = 1;
export const MAX_LOOP_BARS = 16;
/** Without `loop`, the shortest loop the screens show: the 4-bar phrase. */
export const DEFAULT_LOOP_BARS = 4;

export interface LoopLength {
  /** Bars of one pass in loop mode, 1..16. */
  readonly bars: number;
  /**
   * True when the text says `loop <bars>`: patterns restart on every pass. False: the
   * length is only shown and every pattern keeps its own cycle, as before `loop` existed.
   */
  readonly declared: boolean;
}

/** `loop <bars>` when written; otherwise the longest pattern, between 4 and 16 bars. */
export function loopLengthOf(program: Pick<Program, "loopBars" | "tracks">): LoopLength {
  if (program.loopBars !== null) return { bars: program.loopBars, declared: true };
  const longest = program.tracks.reduce((bars, track) => Math.max(bars, track.pattern.bars.length), 0);
  return { bars: Math.min(MAX_LOOP_BARS, Math.max(DEFAULT_LOOP_BARS, longest)), declared: false };
}

/** The section marked "| loop": what loop mode plays, at its tempo; null without one. */
export function loopSectionOf(program: Pick<Program, "sections">): Section | null {
  return program.sections.find((section) => section.isLoop) ?? null;
}
