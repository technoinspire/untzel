// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyTextDiff, diffText } from "./text-diff";

/** A lone half of a surrogate pair. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
/** Texts made of a few characters, astral ones included, so prefixes and suffixes are shared often. */
const text = fc.array(fc.constantFrom("a", "b", "\n", "🎛", "🎚", "𝄞", "é"), { maxLength: 40 }).map((parts) => parts.join(""));

describe("diffText and applyTextDiff", () => {
  it("round-trips any pair of texts, the empty one included", () => {
    fc.assert(
      fc.property(text, text, (previous, next) => {
        expect(applyTextDiff(previous, diffText(previous, next))).toBe(next);
      }),
      { numRuns: 1_000 },
    );
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 60 }), fc.string({ unit: "binary", maxLength: 60 }), (previous, next) => {
        expect(applyTextDiff(previous, diffText(previous, next))).toBe(next);
      }),
    );
  });
  it("never splits a surrogate pair", () => {
    fc.assert(
      fc.property(text, text, (previous, next) => {
        const diff = diffText(previous, next);
        expect(LONE_SURROGATE.test(diff.insert)).toBe(false);
        expect(LONE_SURROGATE.test(previous.slice(diff.at, diff.at + diff.remove))).toBe(false);
      }),
      { numRuns: 1_000 },
    );
    // The two pairs share their high half: the diff takes both pairs whole.
    expect(diffText("x🎛y", "x🎚y")).toEqual({ at: 1, remove: 2, insert: "🎚" });
  });
  it("is the middle edit between the common prefix and suffix", () => {
    expect(diffText("", "")).toEqual({ at: 0, remove: 0, insert: "" });
    expect(diffText("", "kick")).toEqual({ at: 0, remove: 0, insert: "kick" });
    expect(diffText("kick x...", "kick x.x.")).toEqual({ at: 7, remove: 1, insert: "x" });
    expect(diffText("abcabc", "abc")).toEqual({ at: 3, remove: 3, insert: "" });
  });
  it("throws a RangeError for a diff outside the text", () => {
    expect(() => applyTextDiff("abc", { at: 4, remove: 0, insert: "" })).toThrow(RangeError);
    expect(() => applyTextDiff("abc", { at: 1, remove: 3, insert: "" })).toThrow(RangeError);
    expect(() => applyTextDiff("abc", { at: -1, remove: 0, insert: "" })).toThrow(RangeError);
    expect(() => applyTextDiff("abc", { at: 0.5, remove: 0, insert: "" })).toThrow(RangeError);
    expect(applyTextDiff("abc", { at: 3, remove: 0, insert: "d" })).toBe("abcd");
  });
});
