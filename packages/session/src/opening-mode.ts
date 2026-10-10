// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The mode received text opens in. A link or a file carries the sender's
// playback mode beside the text, never in it: the mode is transport state.
// Types only besides the rule, so the initial JS can import this subpath.
import type { Program } from "@untzel/core";
import type { PlaybackMode, PlayRange } from "@untzel/transport";

/**
 * The sender's mode when the link or file carries one; without it (links and files made
 * before modes were carried), `song` when the text has a `song` line, else `loop`. Song mode needs
 * sections: without them the text opens in loop whatever was carried.
 */
export function openingMode(carried: PlaybackMode | null, program: Pick<Program, "song" | "sections">): PlaybackMode {
  const mode = carried ?? (program.song !== null ? "song" : "loop");
  return mode === "song" && program.sections.length === 0 ? "loop" : mode;
}

/** A play range as a link, a file or a project carries it: beside the mode whose ruler it counts on. */
export interface CarriedRange {
  readonly mode: PlaybackMode;
  readonly range: PlayRange;
}

/** The range that came with its mode; null when either is missing (made before the range travelled). */
export function carriedRange(mode: PlaybackMode | null, range: PlayRange | null): CarriedRange | null {
  return mode === null || range === null ? null : { mode, range };
}
