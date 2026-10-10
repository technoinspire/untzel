// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { GRAMMAR_NODE_TYPES, classifyTokens, syntaxNodeTypes, type TokenKind } from "./classify-tokens";

function kinds(source: string): readonly (readonly [string, TokenKind])[] {
  return classifyTokens(source).map((span) => [source.slice(span.from, span.to), span.kind] as const);
}

describe("classifyTokens", () => {
  it("classifies every kind of token", () => {
    const source = [
      "tempo 124 // warm",
      "key c minor",
      "kick: kick x... X.x~ | drive 0.3",
      "bass c2 eb2? [g1 c2]*2 ~ | cutoff sine(8) 300..1400 | delay 3/16 | reverb sea",
      "pad Cm7",
      "section drop kick bass | tempo 126",
      "song drop 16 | loop",
    ].join("\n");
    const result = kinds(source);
    expect(result).toContainEqual(["tempo", "keyword"]);
    expect(result).toContainEqual(["// warm", "comment"]);
    expect(result).toContainEqual(["124", "number"]);
    expect(result).toContainEqual(["key", "keyword"]);
    expect(result).toContainEqual(["c", "note"]);
    expect(result).toContainEqual(["minor", "number"]);
    expect(result).toContainEqual(["X.x~", "hits"]);
    expect(result).toContainEqual(["drive", "modifier"]);
    expect(result).toContainEqual(["eb2", "note"]);
    expect(result).toContainEqual(["~", "hits"]);
    expect(result).toContainEqual(["sine", "signal"]);
    expect(result).toContainEqual(["..", "punctuation"]);
    expect(result).toContainEqual(["sea", "number"]);
    expect(result).toContainEqual(["Cm7", "chord"]);
    expect(result).toContainEqual(["section", "keyword"]);
    expect(result).toContainEqual(["drop", "section"]);
    expect(result).toContainEqual(["loop", "keyword"]);
    expect(result.slice(6, 9)).toEqual([
      ["kick", "track"],
      [":", "punctuation"],
      ["kick", "instrument"],
    ]);
  });

  it("names the section first and its tracks after it", () => {
    expect(kinds("section drop kick bass")).toEqual([
      ["section", "keyword"],
      ["drop", "section"],
      ["kick", "track"],
      ["bass", "track"],
    ]);
  });

  it("reads tempo and swing after a bar as modifiers", () => {
    expect(kinds("hat ..x. | swing 0.1")).toContainEqual(["swing", "modifier"]);
    expect(kinds("section a k | tempo 120")).toContainEqual(["tempo", "modifier"]);
  });

  it("keeps spans ordered, inside the text and without overlap, even with a syntax error", () => {
    const source = "kick: kick x... ]] | gain\nbass c2 h2 [";
    const spans = classifyTokens(source);
    spans.forEach((span, index) => {
      expect(span.from).toBeLessThan(span.to);
      expect(span.to).toBeLessThanOrEqual(source.length);
      if (index > 0) expect(span.from).toBeGreaterThanOrEqual(spans[index - 1]?.to ?? 0);
    });
  });
});

describe("grammar node coverage", () => {
  it("lists the meaningful node types of the grammar", () => {
    expect(GRAMMAR_NODE_TYPES).toContain("SignalShape");
    expect(GRAMMAR_NODE_TYPES).not.toContain("Source");
    expect(GRAMMAR_NODE_TYPES).not.toContain("Line");
  });

  it("collects the node types of a text", () => {
    const types = syntaxNodeTypes("song intro 8 | loop");
    expect(types.has("SongDecl")).toBe(true);
    expect(types.has("Part")).toBe(true);
    expect(types.has("Track")).toBe(false);
  });
});
