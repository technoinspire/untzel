// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The pattern chips' intents of the deferred port: forwarded to the running controls once
// the engine runs, dropped before. Part of the initial JS: types only.
import type { PatternIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardPatterns(running: () => RunningControls | null): PatternIntents {
  return {
    previewPattern: (track, pattern) => running()?.patterns.previewPattern(track, pattern),
    usePattern: (track, pattern) => running()?.patterns.usePattern(track, pattern),
    endTrackPreview: () => running()?.patterns.endTrackPreview(),
  };
}
