// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { PlaybackPosition, PlayRangeView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { nowOf } from "./playback-now";
import { sessionFixture } from "./testing/session-fixture";
import { playRangeView, transportView } from "./transport-presenter";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
const TEXT = `tempo 124
key d dorian
loop 8
kick: kick x... x... x... x...
hat: hat ..x. ..x. ..x. ..x.
section groove kick | loop
section drop kick hat | tempo 130
song groove 4, drop 8
`;
const NO_RANGES: PlayRangeView = { mode: "loop", range: null, loop: null, song: null, lastBar: 8, songNames: null, notice: null };
function position(fields: Partial<PlaybackPosition>): PlaybackPosition {
  return { frame: 0, bar: 0, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar: 0, loopBar: null, loopBars: null, framesPerBar: 1_000, ...fields };
}
function playing(mode: "loop" | "song", at: PlaybackPosition) {
  const { session, sound } = fixture.sessionOf(TEXT);
  session.play(mode);
  sound.emitPosition(at);
  const view = session.view();
  return { view, now: nowOf(view, null, 48_000) };
}
describe("transportView", () => {
  it("stopped: the text's tempo, key and loop, no bar, the loop section as caption", () => {
    const view = fixture.viewOf(TEXT);
    expect(transportView(view, null, NO_RANGES)).toEqual({
      isPlaying: false,
      bpm: 124,
      key: "d dorian",
      keyTonic: "d",
      keyScale: "dorian",
      songTempo: 124,
      tempoSetBy: null,
      mode: "loop",
      cpu: view.load.fraction,
      isDropArmed: false,
      totalBars: null,
      loopBars: 8,
      isLoopDeclared: true,
      section: "groove",
      bar: null,
      progress: 0,
      nextBar: 0,
      loopBar: null,
      loopBarsSounding: null,
    });
  });
  it("in loop mode: the bar of the loop sounding and its progress", () => {
    const { view, now } = playing("loop", position({ bar: 5, patternBar: 5, loopBar: 2, loopBars: 8 }));
    expect(transportView(view, now, NO_RANGES)).toMatchObject({ isPlaying: true, bar: 6, loopBar: 3, loopBarsSounding: 8, progress: 0.25, nextBar: 0 });
  });
  it("in song mode: the song bar from the part and the bar in it, and the part's own tempo", () => {
    const { view, now } = playing("song", position({ mode: "song", bar: 9, partIndex: 1, section: "drop", barInPart: 2, totalBars: 12 }));
    expect(transportView(view, now, { ...NO_RANGES, mode: "song", lastBar: 12 })).toMatchObject({
      mode: "song",
      section: "drop",
      totalBars: 12,
      bar: 7,
      progress: 0.5,
      loopBar: null,
      tempoSetBy: "drop",
    });
  });
});
describe("playRangeView", () => {
  it("puts the playhead on the ruler of the mode that sounds, and the song's parts 1-based", () => {
    const { view, now } = playing("song", position({ mode: "song", bar: 9, partIndex: 1, section: "drop", barInPart: 2, totalBars: 12 }));
    const ranges: PlayRangeView = { ...NO_RANGES, mode: "song", lastBar: 12 };
    const transport = transportView(view, now, ranges);
    expect(playRangeView(view, ranges, transport)).toEqual({
      mode: "song",
      lastBar: 12,
      range: null,
      sounding: null,
      playheadBar: 7,
      parts: [
        { name: "groove", startBar: 1, endBar: 4 },
        { name: "drop", startBar: 5, endBar: 12 },
      ],
      songNames: null,
    });
    expect(playRangeView(view, NO_RANGES, transport)).toMatchObject({ mode: "loop", playheadBar: null, parts: [] });
  });
});
