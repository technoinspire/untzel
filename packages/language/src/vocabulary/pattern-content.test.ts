// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PatternSpec } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { canPlay, patternContent } from "./pattern-content";

const REGISTRY = registryWith();

/** The spec the analysis reads for `pattern` on `instrument`. */
function specOf(pattern: string, instrument = "pad"): PatternSpec {
  const result = analyze(`t: ${instrument} ${pattern}`, REGISTRY);
  if (!result.ok) throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  const track = result.program.tracks[0];
  if (track === undefined) throw new Error("no track");
  return track.pattern;
}

describe("patternContent", () => {
  it.each([
    ["c2 . . c2", "bass", ["notes"]],
    ["x... x...", "kick", ["hits"]],
    ["....", "kick", []],
    ["Cm7 ~ . .", "pad", ["chords"]],
    ["c3+eb3+g3 .", "pad", ["chords"]],
  ] as const)("%s on %s plays %j", (pattern, instrument, content) => {
    expect(patternContent(specOf(pattern, instrument))).toEqual(content);
  });

  it("walks groups, and a rest is never a hit", () => {
    const spec: PatternSpec = {
      bars: [
        {
          source: { from: 0, to: 0 },
          elements: [
            {
              kind: "group",
              elements: [
                { kind: "note", midi: 36, accent: false, probability: null, repeat: 1, source: { from: 0, to: 0 } },
                { kind: "hits", steps: ["rest"], accent: false, probability: null, repeat: 1, source: { from: 0, to: 0 } },
              ],
              accent: false,
              probability: null,
              repeat: 1,
              source: { from: 0, to: 0 },
            },
            { kind: "hits", steps: ["hit", "rest"], accent: false, probability: null, repeat: 1, source: { from: 0, to: 0 } },
          ],
        },
      ],
    };
    expect(patternContent(spec)).toEqual(["notes", "hits"]);
  });

  it("keeps a rest-heavy bass compatible with every instrument that plays notes", () => {
    const content = patternContent(specOf(". . . c2 . . . . . . . . . . eb2 .", "bass"));
    expect(content).toEqual(["notes"]);
    expect(canPlay("pitched", content)).toBe(true);
    expect(canPlay("chord", content)).toBe(true);
    expect(canPlay("drum", content)).toBe(false);
  });
});

describe("canPlay", () => {
  it("follows the language: drums hits, pitched notes, chord chords and notes", () => {
    expect(canPlay("drum", ["hits"])).toBe(true);
    expect(canPlay("pitched", ["chords"])).toBe(false);
    expect(canPlay("chord", ["notes", "chords"])).toBe(true);
    expect(canPlay("chord", ["hits"])).toBe(false);
    expect(canPlay("drum", [])).toBe(true);
  });
});
