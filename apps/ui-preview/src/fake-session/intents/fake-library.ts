// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Add track library of the fake session: a track added from the fixture's library
// waits for the next bar; listening first is silent here, the preview has no engine.

import type { LibraryIntents } from "@untzel/skin-contract";
import type { TrackFixture } from "../fixtures";
import { stepsOf } from "../fixtures";
import { trackStateOf, type FakeState } from "../fake-state";

function addTrack(state: FakeState, instrument: string): string {
  const name = state.freeName(instrument);
  const entry = state.fixture.library.find((item) => item.instrument === instrument);
  const pitched = entry !== undefined && entry.group !== "drums" && entry.group !== "fx";
  const fixture: TrackFixture = {
    name,
    instrument,
    group: entry?.group ?? "drums",
    kind: pitched ? "pitched" : "drum",
    line: state.tracks.length + 4,
    pattern: pitched ? "c2 . . c2 . . c2 ." : "x... x... x... x...",
    tone: 0.5,
    sound: [{ name: "decay", display: "0.30 s", fraction: 0.5, signal: null, toneRole: null }],
    mix: state.tracks[0]?.fixture.mix ?? [],
  };
  state.tracks.push({ ...trackStateOf(fixture, [stepsOf(fixture.pattern)]), isOn: false, isQueued: true, isMuted: false, tone: 0.5 });
  state.emit();
  return name;
}

export function fakeLibrary(state: FakeState): LibraryIntents {
  return {
    preview: () => undefined,
    stopPreview: () => undefined,
    addTrack: (instrument) => addTrack(state, instrument),
    startWithSound: (instrument) => addTrack(state, instrument),
  };
}
