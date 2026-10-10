// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The track detail's sound intents of the deferred port: forwarded to the running controls
// once the engine runs, dropped before. Part of the initial JS: types only.
import type { SoundIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardSound(running: () => RunningControls | null): SoundIntents {
  return {
    setSound: (track, sound) => running()?.sound.setSound(track, sound),
    addEffect: (track, effect) => running()?.sound.addEffect(track, effect),
    removeEffect: (track, effect) => running()?.sound.removeEffect(track, effect),
    previewTrackSound: (track, instrument, sound) => running()?.sound.previewTrackSound(track, instrument, sound),
    setTrackSound: (track, instrument, sound) => running()?.sound.setTrackSound(track, instrument, sound),
  };
}
