// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The touched note's audition of the deferred port: forwarded to the running
// controls once the engine runs, dropped before. Part of the initial JS: types only.
import type { AuditionIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardAudition(running: () => RunningControls | null): AuditionIntents {
  return {
    audition: (track, sound) => running()?.audition.audition(track, sound),
  };
}
