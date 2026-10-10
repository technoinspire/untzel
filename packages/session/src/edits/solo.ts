// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { GeneralParameter, type Program, type Track } from "@untzel/core";

/**
 * The program the sound hears while a track is held in solo: every other track with
 * `audible` 0. Solo is transient performance state, like the playback mode, so it never
 * reaches the text. Only a constant changes, so the transport applies it at
 * once with a 20 ms ramp. `gain` is left as written: the DSP silences after gain and its
 * modulators, so a gain driven by a signal or a fast LFO goes silent like a constant one.
 */
export function soloProgram(program: Program, soloed: string): Program {
  const tracks = program.tracks.map((track) => (track.name === soloed ? track : silenced(track)));
  return { ...program, tracks };
}

function silenced(track: Track): Track {
  return {
    ...track,
    parameters: track.parameters.map((parameter) =>
      parameter.index === GeneralParameter.audible
        ? { ...parameter, value: { kind: "constant", value: 0 } }
        : parameter,
    ),
  };
}
