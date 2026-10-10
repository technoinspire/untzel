// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TITLE_MAX_CODE_POINTS, normalizeTitle, titleLength, titleSlug, withPrefix, withSuffix } from "./song-title";
const REMIX_PREFIXES = ["Remix of", "Remix de"];
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
describe("normalizeTitle", () => {
  it("removes control characters, tab and newline included", () => {
    expect(normalizeTitle("A\u0007B")).toBe("AB");
    expect(normalizeTitle("A\u0085B\u009FC")).toBe("ABC");
    expect(normalizeTitle("Midnight\tCoast\n")).toBe("MidnightCoast");
  });
  it("removes the embedding and isolate formatters", () => {
    expect(normalizeTitle("\u202Eevil")).toBe("evil");
    expect(normalizeTitle("a\u202Ab\u202Bc\u202Cd\u202De")).toBe("abcde");
    expect(normalizeTitle("x\u2066y\u2069")).toBe("xy");
    expect(normalizeTitle("x\u2067y\u2068z")).toBe("xyz");
  });
  it("keeps ZWJ emoji, variation selectors and the plain direction marks", () => {
    expect(normalizeTitle("👨‍👩‍👧")).toBe("👨‍👩‍👧");
    expect(normalizeTitle("❤️ song")).toBe("❤️ song");
    expect(normalizeTitle("a\u200Eb\u200Fc")).toBe("a\u200Eb\u200Fc");
  });
  it("collapses white space and trims the ends", () => {
    expect(normalizeTitle("  Midnight    Coast  ")).toBe("Midnight Coast");
    expect(normalizeTitle("   ")).toBe("");
  });
  it("cuts at 60 code points, not UTF-16 units", () => {
    const emoji = "🌊".repeat(61);
    expect(titleLength(normalizeTitle(emoji))).toBe(60);
    expect(normalizeTitle("a".repeat(61))).toBe("a".repeat(60));
  });
  it("never returns more than 60 code points nor a broken surrogate", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 120 }), (raw) => {
        const title = normalizeTitle(raw);
        expect(titleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CODE_POINTS);
        expect(title).not.toMatch(LONE_SURROGATE);
        expect(normalizeTitle(title)).toBe(title);
      }),
    );
  });
});
describe("titleSlug", () => {
  it("lower case, accents removed, dashes between words", () => {
    expect(titleSlug("Midnight Coast")).toBe("midnight-coast");
    expect(titleSlug("Ação à Noite!")).toBe("acao-a-noite");
    expect(titleSlug("  --Night__Drive--  ")).toBe("night-drive");
  });
  it("is empty when nothing is a letter or a digit", () => {
    expect(titleSlug("🌊🌊")).toBe("");
    expect(titleSlug("")).toBe("");
  });
  it("is always safe for a file name and at most 48 characters", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 120 }), (raw) => {
        const slug = titleSlug(raw);
        expect(slug.length).toBeLessThanOrEqual(48);
        expect(slug).not.toMatch(/[\\/:*?"<>|.\s]/u);
        expect(slug).not.toMatch(/^-|-$/);
      }),
    );
  });
});
describe("withPrefix", () => {
  it("adds the prefix once", () => {
    expect(withPrefix("Midnight Coast", "Remix of", REMIX_PREFIXES)).toBe("Remix of Midnight Coast");
  });
  it("does not stack a prefix of another language", () => {
    expect(withPrefix("Remix de X", "Remix of", REMIX_PREFIXES)).toBe("Remix de X");
  });
  it("compares without case", () => {
    expect(withPrefix("remix of x", "Remix of", REMIX_PREFIXES)).toBe("remix of x");
    expect(withPrefix("Remix of", "Remix of", REMIX_PREFIXES)).toBe("Remix of");
  });
  it("needs the space after the prefix", () => {
    expect(withPrefix("Remixed", "Remix of", REMIX_PREFIXES)).toBe("Remix of Remixed");
  });
  it("cuts a long title at 60 code points", () => {
    const title = withPrefix("a".repeat(58), "Remix of", REMIX_PREFIXES);
    expect(titleLength(title)).toBe(60);
    expect(title.startsWith("Remix of a")).toBe(true);
  });
});
describe("withSuffix", () => {
  it("appends the copy suffix and stacks it on a copy", () => {
    expect(withSuffix("Midnight Coast", "(copy)")).toBe("Midnight Coast (copy)");
    expect(withSuffix("X (copy)", "(copy)")).toBe("X (copy) (copy)");
  });
});
