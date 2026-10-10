// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program } from "@untzel/core";

// Preview of an existing track (the pattern chips of the track detail and Change sound):
// the track itself plays a candidate inside the music, from the
// next bar, without the text changing. A transient substitution of the program, in the
// mould of soloProgram; the text, the history, links, files and exports never see it.

/** A preview ends by itself after this many bars, like the library's audition. */
export const TRACK_PREVIEW_BARS = 16;

/** `program` with the track `track` replaced by the track of the same name in `candidate`. */
export function previewProgram(program: Program, track: string, candidate: Program): Program {
  const replacement = candidate.tracks.find((entry) => entry.name === track);
  if (replacement === undefined || !program.tracks.some((entry) => entry.name === track)) return program;
  return { ...program, tracks: program.tracks.map((entry) => (entry.name === track ? replacement : entry)) };
}

/** A preview in course: what it plays and since which bar. No clock: the session passes positions. */
export class TrackPreview {
  readonly track: string;
  /** The candidate text: what Use writes, so what is heard is what is written. */
  readonly text: string;
  readonly program: Program;
  /** What the person picked, for the view ("Broken", "acid · squelch"). */
  readonly label: string;
  #sinceBar: number | null;

  constructor(track: string, text: string, program: Program, label: string, sinceBar: number | null) {
    this.track = track;
    this.text = text;
    this.program = program;
    this.label = label;
    this.#sinceBar = sinceBar;
  }

  /** True once the transport reached `bar` 16 bars after the start (the first report starts the count). */
  endsAt(bar: number): boolean {
    this.#sinceBar ??= bar;
    return bar >= this.#sinceBar + TRACK_PREVIEW_BARS;
  }

  isStale(program: Program): boolean {
    return !program.tracks.some((entry) => entry.name === this.track);
  }
}
