// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { playbackParams, readPlaybackParams } from "./playback-param";

const SONG_RANGE = { startBar: 9, endBar: 28, cycle: false };

describe("playbackParams", () => {
  it("writes the mode, then its range, then cycle only when off", () => {
    expect(playbackParams("song", SONG_RANGE)).toEqual(["mode=song", "range=9-28", "cycle=off"]);
    expect(playbackParams("song", { ...SONG_RANGE, cycle: true })).toEqual(["mode=song", "range=9-28"]);
    expect(playbackParams("loop", { startBar: 2, endBar: 3, cycle: true })).toEqual(["mode=loop", "range=2-3"]);
    expect(playbackParams("loop", null)).toEqual(["mode=loop"]);
  });

  it("writes nothing without a mode, range or not", () => {
    expect(playbackParams(null, SONG_RANGE)).toEqual([]);
    expect(playbackParams(null, null)).toEqual([]);
  });
});

describe("readPlaybackParams", () => {
  it("round-trips what playbackParams writes", () => {
    for (const [mode, range] of [
      ["song", SONG_RANGE],
      ["song", { ...SONG_RANGE, cycle: true }],
      ["loop", { startBar: 1, endBar: 1, cycle: true }],
      ["loop", null],
    ] as const) {
      expect(readPlaybackParams(playbackParams(mode, range))).toEqual({ mode, range });
    }
  });

  it("reads before either parameter existed as no mode and no range", () => {
    expect(readPlaybackParams([])).toEqual({ mode: null, range: null });
    expect(readPlaybackParams(["mode=song"])).toEqual({ mode: "song", range: null });
  });

  it("drops a range without a valid mode", () => {
    expect(readPlaybackParams(["range=2-3"])).toEqual({ mode: null, range: null });
    expect(readPlaybackParams(["mode=dance", "range=2-3"])).toEqual({ mode: null, range: null });
  });

  it("ignores garbage, in any order, and keeps the last valid value", () => {
    for (const value of ["", "3", "3-", "-3", "0-4", "4-3", "a-b", "1-2-3", "01-4", "10000-10001", "2-3=x"]) {
      expect(readPlaybackParams(["mode=song", `range=${value}`]).range).toBeNull();
    }
    expect(readPlaybackParams(["cycle=off", "x=1", "range=5-8", "mode=song", "range=oops", "cycle=maybe"])).toEqual({
      mode: "song",
      range: { startBar: 5, endBar: 8, cycle: false },
    });
    expect(readPlaybackParams(["mode=song", "range=2-3", "range=4-6"]).range).toEqual({ startBar: 4, endBar: 6, cycle: true });
  });

  it("a loop range always repeats", () => {
    expect(readPlaybackParams(["mode=loop", "range=2-3", "cycle=off"]).range).toEqual({ startBar: 2, endBar: 3, cycle: true });
  });
});
