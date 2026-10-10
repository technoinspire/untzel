// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The sender's playback mode beside the text, as `mode=loop` or `mode=song`:
// after the payload of a link (`&mode=loop`) and on the format line of a file
// (`// untzel 1 mode=loop`). Never inside the text: the mode is transport state.
import type { PlaybackMode } from "@untzel/session";

const KEY = "mode";

/** `mode=loop`; empty without a mode. */
export function modeParam(mode: PlaybackMode | null): string {
  return mode === null ? "" : `${KEY}=${mode}`;
}

/**
 * The mode among `key=value` pairs. Unknown keys and unknown values are ignored, so a
 * newer sender's extra parameters never break the text; the last valid `mode` wins.
 */
export function readModeParam(pairs: readonly string[]): PlaybackMode | null {
  let mode: PlaybackMode | null = null;
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator) !== KEY) continue;
    const value = pair.slice(separator + 1);
    if (value === "loop" || value === "song") mode = value;
  }
  return mode;
}
