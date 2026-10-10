// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ActivatedTrack, ProgramActivation } from "@untzel/session";
import type { WorkerToWorkletMessage, WorkletActivatedTrack } from "./messages";

/** instrumentId of a name that is not in the list: the DSP answers "no slot" and the track stays mute. */
export const UNKNOWN_INSTRUMENT_ID = 0xffffffff;

type ProgramMessage = Extract<WorkerToWorkletMessage, { readonly type: "program" }>;

/** Replaces each track's instrument name by its instrumentId (position in `instruments`). */
export function toWorkletProgram(
  change: ProgramActivation,
  instruments: readonly string[],
): ProgramMessage {
  return {
    type: "program",
    generation: change.generation,
    atFrame: change.atFrame,
    tracks: change.tracks.map((track) => toWorkletTrack(track, instruments)),
  };
}

/** One activated track with its instrumentId. */
export function toWorkletTrack(track: ActivatedTrack, instruments: readonly string[]): WorkletActivatedTrack {
  const id = instruments.indexOf(track.instrument);
  return {
    name: track.name,
    instrumentId: id < 0 ? UNKNOWN_INSTRUMENT_ID : id,
    parameters: track.parameters,
    effects: track.effects,
    modulators: track.modulators,
  };
}
