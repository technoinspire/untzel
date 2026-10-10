// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The bar lines the DSP host can see: every tempo message of the transport starts a bar
// (a play, or a section with its own tempo), and bars have four beats. A sample pack that
// arrives while the music plays starts on the next bar line.

export interface TempoMark {
  /** Frame of a bar line where this tempo starts. */
  readonly frame: number;
  readonly bpm: number;
}

/** The marks a host keeps: the one in force and those already announced after it. */
export const MAX_TEMPO_MARKS = 8;

/** Adds a tempo mark, keeping the latest MAX_TEMPO_MARKS in frame order. */
export function withTempoMark(marks: readonly TempoMark[], mark: TempoMark): TempoMark[] {
  return [...marks.filter((kept) => kept.frame < mark.frame), mark].slice(-MAX_TEMPO_MARKS);
}

/** The first bar line at or after `frame`; `frame` itself when nothing plays (no mark). */
export function nextBarFrame(marks: readonly TempoMark[], frame: number, sampleRate: number): number {
  const first = marks[0];
  if (first === undefined) return frame;
  if (frame <= first.frame) return first.frame;
  const index = marks.findLastIndex((mark) => mark.frame <= frame);
  const current = marks[index] ?? first;
  const bar = (240 * sampleRate) / current.bpm;
  const line = Math.round(current.frame + Math.ceil((frame - current.frame) / bar) * bar);
  const following = marks[index + 1];
  return following === undefined ? line : Math.min(line, following.frame);
}
