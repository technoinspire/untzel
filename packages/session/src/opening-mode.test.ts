// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { fakeProgram, fakeSection, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { carriedRange, openingMode } from "./opening-mode";

const LOOP_ONLY = fakeProgram([fakeTrack("kick")]);
const SECTIONS = fakeProgram([fakeTrack("kick")], { sections: [fakeSection("a", ["kick"])] });
const SONG = fakeProgram([fakeTrack("kick")], {
  sections: [fakeSection("a", ["kick"])],
  song: { parts: [{ section: "a", bars: 4 }], loop: false },
});

describe("openingMode", () => {
  it("the carried mode wins: a song text sent in loop opens in loop, and in song when sent so", () => {
    expect(openingMode("loop", SONG)).toBe("loop");
    expect(openingMode("song", SONG)).toBe("song");
    expect(openingMode("song", SECTIONS)).toBe("song");
  });

  it("without a carried mode: song when the text has a song line, else loop", () => {
    expect(openingMode(null, SONG)).toBe("song");
    expect(openingMode(null, SECTIONS)).toBe("loop");
    expect(openingMode(null, LOOP_ONLY)).toBe("loop");
  });

  it("song without sections cannot play: loop", () => {
    expect(openingMode("song", LOOP_ONLY)).toBe("loop");
  });
});

describe("carriedRange", () => {
  it("is the range with its mode, and null when either did not travel", () => {
    const range = { startBar: 2, endBar: 3, cycle: true };
    expect(carriedRange("loop", range)).toEqual({ mode: "loop", range });
    expect(carriedRange(null, range)).toBeNull();
    expect(carriedRange("song", null)).toBeNull();
  });
});
