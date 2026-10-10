// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { PlaybackPosition } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { barPosition, nowOf, wrap } from "./playback-now";
import { sessionFixture } from "./testing/session-fixture";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
const RATE = 48_000;
function position(bar: number, patternBar: number): PlaybackPosition {
  return { frame: RATE, bar, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar, loopBar: null, loopBars: null, framesPerBar: 96_000 };
}
describe("barPosition", () => {
  it("counts whole bars past the reported boundary and the fraction of the current one", () => {
    const barFrames = (240 * RATE) / 120;
    expect(barPosition(position(4, 0), 120, RATE + barFrames * 1.25, RATE)).toEqual({ bar: 5, fraction: 0.25 });
  });
  it("stays on the reported bar without a frame, a rate or a tempo", () => {
    expect(barPosition(position(4, 0), 120, null, RATE)).toEqual({ bar: 4, fraction: 0 });
    expect(barPosition(position(4, 0), 120, 10, 0)).toEqual({ bar: 4, fraction: 0 });
    expect(barPosition(position(4, 0), 0, 10, RATE)).toEqual({ bar: 4, fraction: 0 });
  });
});
describe("wrap", () => {
  it("is the non-negative remainder: bar -1 of a 4-bar loop is its bar 3", () => {
    expect(wrap(-1, 4)).toBe(3);
    expect(wrap(9, 4)).toBe(1);
  });
});
describe("nowOf", () => {
  it("is null while stopped", () => {
    expect(nowOf(fixture.viewOf("tempo 120\nkick: kick x... x... x... x...\n"), RATE, RATE)).toBeNull();
  });
  it("extrapolates the pattern bar from the latest report at the text's tempo", () => {
    const { session, sound } = fixture.sessionOf("tempo 120\nkick: kick x... x... x... x...\n");
    session.play("loop");
    sound.emitPosition(position(2, 6));
    const barFrames = (240 * RATE) / 120;
    expect(nowOf(session.view(), RATE + barFrames * 2.5, RATE)).toEqual({ patternBar: 8, elapsed: 2, fraction: 0.5, bar: 4 });
    expect(nowOf(session.view(), null, RATE)).toEqual({ patternBar: 6, elapsed: 0, fraction: 0, bar: 2 });
  });
});
