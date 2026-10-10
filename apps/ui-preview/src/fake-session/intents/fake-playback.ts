// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport's intents of the fake session: play and stop, Loop and Song, the drop and
// the loop's length.

import type { PlaybackIntents } from "@untzel/skin-contract";
import type { PlaybackMode } from "@untzel/session";
import type { FakeState } from "../fake-state";

function togglePlay(state: FakeState): void {
  state.isPlaying = !state.isPlaying;
  state.announce(state.isPlaying ? "Playing." : "Stopped.");
  state.emitMode();
  state.emit();
}

function stop(state: FakeState): void {
  state.isPlaying = false;
  state.emitMode();
  state.emit();
}

function setMode(state: FakeState, mode: PlaybackMode): void {
  state.mode = mode;
  state.announce(mode === "song" ? "Song mode from the next phrase." : "Loop mode from the next phrase.");
  state.emit();
}

function drop(state: FakeState): void {
  for (const track of state.tracks) if (!track.isOn) track.isQueued = true;
  state.announce("Drop: every track enters after a 4-bar rise.");
  state.emit();
}

function setLoopBars(state: FakeState, bars: number): void {
  state.loopBars = Math.min(16, Math.max(1, bars));
  state.announce(`Loop of ${state.loopBars} bars from the next bar.`);
  state.emit();
}

export function fakePlayback(state: FakeState): PlaybackIntents {
  return {
    togglePlay: () => togglePlay(state),
    stop: () => stop(state),
    setMode: (mode) => setMode(state, mode),
    drop: () => drop(state),
    setLoopBars: (bars) => setLoopBars(state, bars),
  };
}
