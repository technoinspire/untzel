// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { soundingOnDocument } from "./sounding-on-document";

const PLAYING = "kick: kick x... x...\nbass: bass c2 . eb2 .";

function rangeOf(text: string, word: string, from = 0): { from: number; to: number } {
  const at = text.indexOf(word, from);
  return { from: at, to: at + word.length };
}

describe("the sounding tokens on the document", () => {
  it("keeps the ranges when the document is the program that plays", () => {
    const ranges = [rangeOf(PLAYING, "x..."), rangeOf(PLAYING, "eb2")];
    expect(soundingOnDocument(ranges, PLAYING, PLAYING)).toBe(ranges);
  });

  it("moves them past an edit before them: kick renamed to kik, the steps stay lit", () => {
    const typed = PLAYING.replace("kick: kick", "kik: kick");
    const shown = soundingOnDocument([rangeOf(PLAYING, "eb2"), rangeOf(PLAYING, "x...")], PLAYING, typed);
    expect(shown.map((range) => typed.slice(range.from, range.to))).toEqual(["eb2", "x..."]);
  });

  it("drops a range the edit rewrote", () => {
    const typed = PLAYING.replace("eb2", "e2");
    const shown = soundingOnDocument([rangeOf(PLAYING, "eb2"), rangeOf(PLAYING, "c2")], PLAYING, typed);
    expect(shown.map((range) => typed.slice(range.from, range.to))).toEqual(["c2"]);
  });

  it("drops a range past the end of the program text", () => {
    expect(soundingOnDocument([{ from: 90, to: 94 }], PLAYING, `${PLAYING} `)).toEqual([]);
  });
});
