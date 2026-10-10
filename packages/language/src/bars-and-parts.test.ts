// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "./read/analyze";
import { addSection, declareSong, duplicatePart, movePart, setPartBars } from "./edits/arrangement-edits";
import { clearBar, readBar, replaceBar } from "./edits/bar-edits";
import type { EditResult, NamedEditResult } from "./edits/text-changes";

// Copy bar, Paste here, Clear bar and the part edits of the Song view.
// Every edit keeps the comments and the spacing.

const registry = registryWith(["kick", "hat", "bass"]);

const SONG = `// my song
tempo 132 // fast
kick:  kick  x... x... x... x... / x.x. x... x... x...   | drive 0.3   // the floor
hat:   hat   ..x. ..x. ..x. ..xx   | swing 0.12
bass:  bass  . c2 . c2 . c2 . eb2 / c2 . . c2 . . g1 .  | cutoff 900  // low end
// arrangement
section intro  kick hat // quiet
section drop   kick hat bass
song intro 8, drop 16 | loop   // the whole thing
`;

function applied(result: EditResult | NamedEditResult): string {
  if (!result.ok) throw new Error(`edit failed: ${result.reason}`);
  return result.source;
}

function comments(source: string): readonly string[] {
  return source.match(/\/\/.*$/gm) ?? [];
}

function expectValid(source: string): void {
  const result = analyze(source, registry);
  expect(result.ok ? [] : result.diagnostics).toEqual([]);
}

function line(source: string, start: string): string {
  return source.split("\n").find((entry) => entry.startsWith(start)) ?? "";
}

describe("copy and paste a bar", () => {
  it("reads a bar as written and pastes it into another bar of the same track", () => {
    const copied = readBar(SONG, "kick", 1);
    expect(copied).toBe("x.x. x... x... x...");
    const next = applied(replaceBar(SONG, "kick", 0, copied ?? ""));
    expect(line(next, "kick:")).toBe("kick:  kick  x.x. x... x... x... / x.x. x... x... x...   | drive 0.3   // the floor");
    expect(comments(next)).toEqual(comments(SONG));
    expectValid(next);
  });

  it("pastes into another track, keeping that line's modifiers and comment", () => {
    const next = applied(replaceBar(SONG, "bass", 1, readBar(SONG, "bass", 0) ?? ""));
    expect(line(next, "bass:")).toBe("bass:  bass  . c2 . c2 . c2 . eb2 / . c2 . c2 . c2 . eb2  | cutoff 900  // low end");
    expectValid(next);
  });

  it("refuses anything that is not one bar, and bars that do not exist", () => {
    for (const text of ["", "x... / x...", "x... | gain 1", "x... // note", "x\nx", "[x x"]) {
      expect(replaceBar(SONG, "kick", 0, text)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    }
    expect(replaceBar(SONG, "kick", 2, "x...")).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
    expect(replaceBar(SONG, "clap", 0, "x...")).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
    expect(readBar(SONG, "kick", 5)).toBeNull();
  });

  it("pasting the same elements changes nothing", () => {
    expect(applied(replaceBar(SONG, "kick", 0, "x... x... x... x..."))).toBe(SONG);
  });
});

describe("clear a bar", () => {
  it("writes rests in words of four on a drum track, keeping the step count", () => {
    const next = applied(clearBar(SONG, "kick", 1, false));
    expect(line(next, "kick:")).toBe("kick:  kick  x... x... x... x... / .... .... .... ....   | drive 0.3   // the floor");
    expectValid(next);
  });

  it("writes one rest per step on a pitched track, so a tap puts a note back", () => {
    const next = applied(clearBar(SONG, "bass", 0, true));
    expect(line(next, "bass:")).toBe("bass:  bass  . . . . . . . . / c2 . . c2 . . g1 .  | cutoff 900  // low end");
    expect(comments(next)).toEqual(comments(SONG));
    expectValid(next);
  });

  it("fails outside the pattern", () => {
    expect(clearBar(SONG, "hat", 1, false)).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
  });
});

describe("parts of the song", () => {
  it("moves a part up or down by swapping it with its neighbour", () => {
    const next = applied(movePart(SONG, 1, -1));
    expect(line(next, "song")).toBe("song drop 16, intro 8 | loop   // the whole thing");
    expect(applied(movePart(next, 0, 1))).toBe(SONG);
    expect(movePart(SONG, 0, -1)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(movePart(SONG, 2, -1)).toEqual({ ok: false, reason: "UNKNOWN_PART" });
    expectValid(next);
  });

  it("duplicates a part right after it, with the song's own separator", () => {
    const tight = SONG.replace("song intro 8, drop 16", "song intro 8,drop 16");
    expect(line(applied(duplicatePart(tight, 0)), "song")).toBe("song intro 8,intro 8,drop 16 | loop   // the whole thing");
    expect(line(applied(duplicatePart(SONG, 1)), "song")).toBe("song intro 8, drop 16, drop 16 | loop   // the whole thing");
    expect(duplicatePart(SONG, 4)).toEqual({ ok: false, reason: "UNKNOWN_PART" });
  });

  it("sets a part's length within the language limits", () => {
    expect(line(applied(setPartBars(SONG, 1, 4)), "song")).toBe("song intro 8, drop 4 | loop   // the whole thing");
    expect(setPartBars(SONG, 1, 257)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });

  it("writes the song that sections alone play, after the last section", () => {
    const sectionsOnly = SONG.replace(/^song.*\n/m, "");
    const next = applied(declareSong(sectionsOnly, [{ section: "intro", bars: 8 }, { section: "drop", bars: 8 }]));
    expect(next.split("\n").slice(6, 9)).toEqual(["section intro  kick hat // quiet", "section drop   kick hat bass", "song intro 8, drop 8"]);
    expectValid(next);
    expect(applied(declareSong(SONG, [{ section: "intro", bars: 8 }]))).toBe(SONG);
    expect(declareSong(sectionsOnly, [{ section: "outro", bars: 8 }])).toEqual({ ok: false, reason: "UNKNOWN_SECTION" });
  });

  it("adds a part from what is playing: a new section and a part at the end of the song", () => {
    const result = addSection(SONG, ["kick", "bass"], 4);
    const next = applied(result);
    expect(result.ok && result.name).toBe("part");
    expect(line(next, "section part")).toBe("section part kick bass");
    expect(line(next, "song")).toBe("song intro 8, drop 16, part 4 | loop   // the whole thing");
    expect(comments(next)).toEqual(comments(SONG));
    expectValid(next);
    const again = addSection(next, ["hat"], 8);
    expect(again.ok && again.name).toBe("part2");
  });

  it("starts the arrangement of a loop with no sections", () => {
    const loop = "tempo 124\nkick: kick x... x... x... x...\nhat: hat ..x. ..x. ..x. ..x.\n";
    const next = applied(addSection(loop, ["kick", "hat"], 8));
    expect(next).toBe("tempo 124\nkick: kick x... x... x... x...\nhat: hat ..x. ..x. ..x. ..x.\nsection part kick hat\nsong part 8\n");
    expectValid(next);
    expect(addSection(loop, [], 8)).toEqual({ ok: false, reason: "SECTION_WOULD_BE_EMPTY" });
    expect(addSection(loop, ["clap"], 8)).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });
});
