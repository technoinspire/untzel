// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { toNumber, type Program } from "@untzel/core";
import type { TrackPreview } from "../audition/track-preview";

// What the view shows of what plays but is not written as it sounds: a track preview,
// and the global tempo under a section's own `| tempo`.

export interface TrackPreviewView {
  readonly track: string;
  /** What the person picked: "Broken", "acid · squelch". */
  readonly label: string;
  /** The instrument and the named sound the track plays in the preview (null: the default sound). */
  readonly instrument: string;
  readonly preset: string | null;
}

export function trackPreviewView(preview: TrackPreview | null): TrackPreviewView | null {
  if (preview === null) return null;
  const playing = preview.program.tracks.find((track) => track.name === preview.track);
  return { track: preview.track, label: preview.label, instrument: playing?.instrument ?? "", preset: playing?.preset ?? null };
}

/** The tempo every part without its own `| tempo` plays at. */
export function songTempoOf(program: Program | null): number | null {
  return program === null ? null : toNumber(program.tempo);
}
