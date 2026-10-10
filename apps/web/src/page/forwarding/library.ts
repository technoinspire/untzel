// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Add track library's intents of the deferred port: forwarded to the running controls
// once the engine runs, dropped before. Part of the initial JS: types only.
import type { LibraryIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardLibrary(running: () => RunningControls | null): LibraryIntents {
  return {
    preview: (instrument, sound, pattern = null) => running()?.library.preview(instrument, sound, pattern),
    stopPreview: () => running()?.library.stopPreview(),
    addTrack: (instrument, sound, pattern = null) => running()?.library.addTrack(instrument, sound, pattern) ?? "",
    startWithSound: (instrument) => running()?.library.startWithSound(instrument) ?? "",
  };
}
