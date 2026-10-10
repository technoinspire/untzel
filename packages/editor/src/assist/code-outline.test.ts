// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { trackColorIndex } from "@untzel/core";
import { untzelParser } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { readOutline, stepRuns } from "./code-outline";
import { hangClass, MAX_HANG, sectionLineClass } from "../highlight/language-marks";
import { wrapsAt } from "../view/line-wrapping";
import { clampSplit, SPLIT_MIN_PX } from "../view/split-separator";

// What the code panel draws, tested without a DOM.

const TEXT = `tempo 132
kick:  kick  x.X~ x...  | drive 0.3 | gain 0.8
hat    ..x.
section intro kick hat
section drop  kick hat ghost
song intro 8, drop 16 | loop
`;

const outline = readOutline(TEXT, untzelParser.parse(TEXT));
const slice = (span: { from: number; to: number }): string => TEXT.slice(span.from, span.to);

describe("code outline", () => {
  it("splits hits words into runs of one step kind", () => {
    expect(stepRuns("x..X~~", 0, 6).map((run) => [run.kind, run.to - run.from])).toEqual([
      ["hit", 1],
      ["rest", 2],
      ["hit-accent", 1],
      ["sustain", 2],
    ]);
  });

  it("gives each track its name, color, label and pattern column", () => {
    expect(outline.tracks.map((track) => [track.line, track.name, slice(track.label), track.hang])).toEqual([
      [2, "kick", "kick", 13],
      [3, "hat", "hat", 7],
    ]);
    expect(outline.tracks[0]?.color).toBe(trackColorIndex("kick"));
  });

  it("colors section members that are tracks, and names the section", () => {
    expect(outline.sectionNames.map(slice)).toEqual(["intro", "drop"]);
    expect(outline.members.map(slice)).toEqual(["kick", "hat", "kick", "hat"]);
    expect(outline.members[1]?.color).toBe(trackColorIndex("hat"));
  });

  it("keeps each modifier with its bar and each song part with its comma", () => {
    expect(outline.groups.map(slice)).toEqual(["| drive 0.3", "| gain 0.8", "intro 8,", "drop 16", "| loop"]);
  });

  it("groups consecutive section lines", () => {
    expect(outline.sectionBlocks).toEqual([[4, 5]]);
    expect(sectionLineClass(0, 2)).toBe("u-block-sections u-block-sections--first");
    expect(sectionLineClass(1, 2)).toBe("u-block-sections u-block-sections--last");
    expect(sectionLineClass(0, 1)).toBe("u-block-sections u-block-sections--first u-block-sections--last");
  });
});

describe("layout rules", () => {
  it("hangs continuation lines from 4 to 32 columns", () => {
    expect(hangClass(3)).toBeNull();
    expect(hangClass(13)).toBe("u-hang-13");
    expect(hangClass(60)).toBe(`u-hang-${MAX_HANG}`);
  });

  it("wraps only on a phone", () => {
    expect(wrapsAt(false)).toBe(true);
    expect(wrapsAt(true)).toBe(false);
  });

  it("keeps the command line between 160 px and 70 % of the area", () => {
    expect(clampSplit(40, 600)).toBe(SPLIT_MIN_PX);
    expect(clampSplit(900, 600)).toBe(420);
    expect(clampSplit(300, 600)).toBe(300);
  });
});
