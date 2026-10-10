// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "./read/analyze";
import { setLoopBars, setStepCount, setTrackBars } from "./edits/length-edits";
import type { EditResult } from "./edits/text-changes";

// `loop <bars>` and the length edits.

const registry = registryWith(["kick", "hat", "bass"]);

const SONG = `// my song
tempo 132 // fast
key c minor

kick:  kick  x... x... x... x...   | drive 0.3   // the floor
hat:   hat   ..x. ..x. ..x. ..xx   | swing 0.12
bass:  bass  . c2 . c2 . c2 . eb2 / c2 . . c2 . . g1 .  | cutoff 900  // low end

section drop kick hat bass
song drop 16
`;

function applied(result: EditResult): string {
  if (!result.ok) throw new Error(`edit failed: ${result.reason}`);
  return result.source;
}

function comments(source: string): readonly string[] {
  return source.match(/\/\/.*$/gm) ?? [];
}

function programOf(source: string) {
  const result = analyze(source, registry);
  if (!result.ok) throw new Error(result.diagnostics.map((d) => `${d.code} ${d.message}`).join("\n"));
  return result.program;
}

function lineOf(source: string, track: string): string {
  return source.split("\n").find((line) => line.startsWith(`${track}:`)) ?? "";
}

describe("loop <bars>", () => {
  it("is optional: without it the program has no loop length (texts play as before)", () => {
    expect(programOf(SONG).loopBars).toBeNull();
  });

  it("reads 1 to 16 bars as a global statement", () => {
    expect(programOf("loop 1\nkick x...").loopBars).toBe(1);
    expect(programOf("tempo 124\nloop 16\nkick x...").loopBars).toBe(16);
  });

  it("keeps loop usable as a track name and in song … | loop", () => {
    const program = programOf("loop: kick x...\nsection a loop\nsong a 4 | loop");
    expect(program.tracks[0]?.name).toBe("loop");
    expect(program.song?.loop).toBe(true);
    expect(program.loopBars).toBeNull();
  });

  it.each([
    ["loop 0", "0"],
    ["loop 17", "17"],
    ["loop 2.5", "2.5"],
    ["loop -4", "-4"],
  ])("%s is OUT_OF_RANGE, pointing at the number", (statement, text) => {
    const source = `${statement}\nkick x...`;
    const result = analyze(source, registry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map((d) => [d.code, source.slice(d.from, d.to), d.message])).toEqual([
      ["OUT_OF_RANGE", text, "loop must be a whole number between 1 and 16."],
    ]);
  });

  it("alone is MISSING_VALUE; twice is DUPLICATE_STATEMENT; after a track is OUT_OF_ORDER", () => {
    const codes = (source: string) => {
      const result = analyze(source, registry);
      return result.ok ? [] : result.diagnostics.map((d) => [d.code, d.message]);
    };
    expect(codes("loop\nkick x...")).toEqual([["MISSING_VALUE", "loop needs a value, for example loop 8."]]);
    expect(codes("loop 4\nloop 8\nkick x...")).toEqual([["DUPLICATE_STATEMENT", "loop is already set on line 1."]]);
    expect(codes("kick x...\nloop 8")).toEqual([["OUT_OF_ORDER", "loop comes before tracks, sections and the song."]]);
  });
});

describe("setLoopBars", () => {
  it("adds the line after the last global, keeping comments", () => {
    const next = applied(setLoopBars(SONG, 8));
    expect(next.split("\n").slice(0, 4)).toEqual(["// my song", "tempo 132 // fast", "key c minor", "loop 8"]);
    expect(comments(next)).toEqual(comments(SONG));
    expect(programOf(next).loopBars).toBe(8);
  });

  it("replaces only the number of an existing statement", () => {
    const source = "loop 4   // short\nkick x...";
    expect(applied(setLoopBars(source, 16))).toBe("loop 16   // short\nkick x...");
  });

  it("goes before the first statement when there is no global, and fills an empty text", () => {
    expect(applied(setLoopBars("// beat\nkick x...", 2))).toBe("// beat\nloop 2\nkick x...");
    expect(applied(setLoopBars("", 3))).toBe("loop 3");
  });

  it("refuses values outside 1..16", () => {
    for (const bars of [0, 17, 2.5, Number.NaN]) expect(setLoopBars(SONG, bars)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("setTrackBars", () => {
  it("adds bars that repeat the last one, with the same separator", () => {
    const next = applied(setTrackBars(SONG, "bass", 4));
    expect(lineOf(next, "bass")).toBe(
      "bass:  bass  . c2 . c2 . c2 . eb2 / c2 . . c2 . . g1 . / c2 . . c2 . . g1 . / c2 . . c2 . . g1 .  | cutoff 900  // low end",
    );
    expect(comments(next)).toEqual(comments(SONG));
    expect(programOf(next).tracks.find((t) => t.name === "bass")?.pattern.bars).toHaveLength(4);
  });

  it("a one-bar pattern grows with ' / ' and 16 bars stay valid", () => {
    const next = applied(setTrackBars(SONG, "kick", 16));
    const kickBars = programOf(next).tracks.find((t) => t.name === "kick")?.pattern.bars ?? [];
    expect(kickBars).toHaveLength(16);
    expect(lineOf(next, "kick")).toContain("x... x... x... x... / x... x... x... x...");
    expect(lineOf(next, "kick")).toMatch(/\| drive 0\.3 {3}\/\/ the floor$/);
  });

  it("removes the last bars and keeps the modifiers and comment", () => {
    const next = applied(setTrackBars(SONG, "bass", 1));
    expect(lineOf(next, "bass")).toBe("bass:  bass  . c2 . c2 . c2 . eb2  | cutoff 900  // low end");
  });

  it("does nothing for the same count; refuses unknown tracks and bad counts", () => {
    expect(applied(setTrackBars(SONG, "hat", 1))).toBe(SONG);
    expect(setTrackBars(SONG, "acid", 2)).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
    expect(setTrackBars(SONG, "hat", 0)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setTrackBars(SONG, "hat", 65)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("setStepCount", () => {
  it("16 → 32 on a drum keeps every hit in time and adds rests", () => {
    const next = applied(setStepCount(SONG, "hat", 32, false));
    expect(lineOf(next, "hat")).toBe("hat:   hat   .... x... .... x... .... x... .... x.x.   | swing 0.12");
    expect(programOf(next).tracks.find((t) => t.name === "hat")?.pattern.bars[0]?.elements).toHaveLength(8);
  });

  it("16 → 8 on a drum keeps the steps on the new grid", () => {
    const next = applied(setStepCount(SONG, "kick", 8, false));
    expect(lineOf(next, "kick")).toBe("kick:  kick  x.x. x.x.   | drive 0.3   // the floor");
  });

  it("8 → 16 on a pitched track holds every note for the same time, in every bar", () => {
    const next = applied(setStepCount(SONG, "bass", 16, true));
    expect(lineOf(next, "bass")).toBe(
      "bass:  bass  . . c2 ~ . . c2 ~ . . c2 ~ . . eb2 ~ / c2 ~ . . . . c2 ~ . . . . g1 ~ . .  | cutoff 900  // low end",
    );
    expect(comments(next)).toEqual(comments(SONG));
    programOf(next);
  });

  it("a held hit stays held: x~~~ (16) → 32 holds for 8 steps", () => {
    const source = "kick: kick x~~~ .... .... ....";
    expect(applied(setStepCount(source, "kick", 32, false))).toBe("kick: kick x~~~ ~~~~ .... .... .... .... .... ....");
  });

  it("refuses counts that do not divide evenly, and a hits word with a suffix", () => {
    expect(setStepCount("kick: kick x.. x.. x..", "kick", 8, false)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setStepCount("kick: kick x.x.? x...", "kick", 16, false)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setStepCount(SONG, "kick", 65, false)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });

  it("keeps single elements with suffixes and groups as one step", () => {
    const source = "kick: kick x? [x x] . x*2";
    expect(applied(setStepCount(source, "kick", 8, false))).toBe("kick: kick x? . [x x] . . . x*2 .");
  });
});
