// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { NamedCommandResult, Session } from "../use-cases/session";
import type { TrackEdits } from "./track-edits";

// The empty state of a project with no track: one tap on Kick, Bass,
// Hats or Chords adds that instrument with its first pattern, in the project's key, and
// plays, so the first tap always makes sound.

/** The four starters, in the order the empty state shows them (Chords is the pad). */
export const STARTER_INSTRUMENTS: readonly string[] = ["kick", "bass", "hat", "pad"];

/** Adds `instrument` with its first pattern in the music's key and starts the transport if it is stopped. */
export function startWithSound(session: Session, edits: TrackEdits, instrument: string): NamedCommandResult {
  const result = edits.addTrack(instrument, null, null);
  if (!result.ok) return result;
  if (!session.view().playing) session.play();
  return result;
}
