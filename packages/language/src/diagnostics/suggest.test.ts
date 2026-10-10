// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { closest, suggest, suggestionReach } from "./suggest";

describe("Did you mean: how far a suggestion reaches", () => {
  it.each([
    ["b", 0],
    ["ky", 1],
    ["pan", 1],
    ["temp", 1],
    ["cutof", 1],
    ["sectoin", 2],
    ["abcdefghi", 3],
  ])("%s reaches %i", (word, reach) => {
    expect(suggestionReach(word)).toBe(reach);
  });

  it("never suggests for a one-character name", () => {
    expect(suggest("b", ["a", "c"])).toBeNull();
  });

  it("does not take pan for gain: two edits for a three-letter word", () => {
    expect(suggest("pan", ["tempo", "gain", "loop"])).toBeNull();
  });

  it("counts a swap of two letters as one edit", () => {
    expect(closest("sectoin", ["section", "song"])).toEqual({ text: "section", safe: true });
  });

  it("is safe only when one candidate is within reach", () => {
    expect(closest("swng", ["swing", "song", "tempo"])).toEqual({ text: "swing", safe: false });
    expect(closest("gian", ["gain", "pan"])).toEqual({ text: "gain", safe: true });
  });

  it("counts a candidate listed twice once", () => {
    expect(closest("gian", ["gain", "gain"])).toEqual({ text: "gain", safe: true });
  });

  it("keeps the first candidate on a tie and ignores an exact match", () => {
    expect(closest("swng", ["song", "swing"])?.text).toBe("song");
    expect(closest("kick", ["kick"])).toBeNull();
  });
});
