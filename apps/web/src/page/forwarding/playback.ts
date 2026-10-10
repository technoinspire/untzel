// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport's intents of the deferred port, with undo and redo: forwarded to the
// running controls once the engine runs, dropped before. Part of the initial JS: types only.
import type { PlaybackIntents, SessionIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardPlayback(running: () => RunningControls | null): PlaybackIntents & Pick<SessionIntents, "undo" | "redo"> {
  return {
    undo: () => running()?.playback.undo() ?? null,
    redo: () => running()?.playback.redo() ?? null,
    togglePlay: () => running()?.playback.togglePlay(),
    stop: () => running()?.playback.stop(),
    setMode: (mode) => running()?.playback.setMode(mode),
    drop: () => running()?.playback.drop(),
    setLoopBars: (bars) => running()?.playback.setLoopBars(bars),
  };
}
