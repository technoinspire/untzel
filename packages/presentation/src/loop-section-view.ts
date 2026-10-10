// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How the loop section reads on the track
// blocks: a track outside it is "not in <section>" in loop mode, and the first such
// block that is not an effect pulses once while the loop plays, to show where to tap.
import type { InstrumentRegistry } from "@untzel/core";
import type { PlaybackMode, SessionView, TrackView } from "@untzel/session";
import type { TrackPlayState } from "./view-model";

/** The tile state of a track, with the song section in song mode and the loop section in loop mode. */
export function trackPlayState(track: TrackView, mode: PlaybackMode): TrackPlayState {
  const outside = mode === "song" ? track.inSection === false : track.inLoopSection === false;
  if (outside && !track.muted) return "not-in-section";
  if (track.status === "queued-on" || track.status === "queued-off") return "queued";
  return track.status;
}

/**
 * Whether the M button reads as pressed. In loop mode with a loop section, Mute takes
 * the track out of that section instead of writing `| mute` (TrackEdits.toggleTrack), so
 * a track outside the loop section is muted for the person too. In song mode, being
 * outside the playing section is the arrangement, not a mute.
 */
export function isTrackMuted(track: TrackView, mode: PlaybackMode): boolean {
  return track.muted || (mode === "loop" && track.inLoopSection === false);
}

/** The section the tile captions name: the playing song section, or the loop section. */
export function captionSection(view: SessionView, songSection: string | null): string | null {
  return (view.mode ?? "loop") === "song" ? songSection : view.loopSection;
}

/**
 * While the loop plays: the first track, in text order, outside the loop section whose
 * instrument is not an effect (in the onboard, the pluck). Null otherwise.
 */
export function hintedTrack(view: SessionView, registry: InstrumentRegistry): string | null {
  if (!view.playing || (view.mode ?? "loop") !== "loop") return null;
  const track = view.tracks.find((candidate) => candidate.inLoopSection === false && registry.get(candidate.instrument)?.group !== "fx");
  return track?.name ?? null;
}
