// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { pitchText, setStepPitch } from "./pitch-edits";
import type { EditResult } from "./text-changes";
import { setTrackFree } from "./track-edits";

// The note picker's edits: any note in any octave, a chord
// and its quality, a hold, a rest, and Scale lock. Comments and spacing stay.

const registry = registryWith(["kick", "hat", "bass"]);

const SONG = `tempo 132
key c minor
// the low end
bass:  bass  c2 . eb2 c3 . c2 g1 .   | cutoff 900  // keep it dark
`;

// Chords need an instrument of kind "chord" (pad, piano), which arrive with the
// instrument library; the analysis refuses them on bass, so this text is only edited.
const CHORDS = "pad:   bass  Cm7 ~ ~ ~                // a chord held for the bar\n";

function applied(result: EditResult): string {
  if (!result.ok) throw new Error(`edit failed: ${result.reason}`);
  return result.source;
}

function line(source: string, name: string): string {
  return source.split("\n").find((entry) => entry.startsWith(`${name}:`)) ?? "";
}

function expectValid(source: string): void {
  const result = analyze(source, registry);
  expect(result.ok ? [] : result.diagnostics).toEqual([]);
}

describe("setStepPitch", () => {
  it("changes the octave of a note, and keeps it when only the letter changes", () => {
    const up = applied(setStepPitch(SONG, "bass", 0, 0, { kind: "note", note: "c3" }));
    expect(line(up, "bass")).toBe("bass:  bass  c3 . eb2 c3 . c2 g1 .   | cutoff 900  // keep it dark");
    const letter = applied(setStepPitch(up, "bass", 0, 0, { kind: "note", note: "f3" }));
    expect(line(letter, "bass")).toContain("bass  f3 . eb2");
    expectValid(letter);
  });

  it("plays a note outside the key: the text says it, Scale lock decides", () => {
    expect(line(applied(setStepPitch(SONG, "bass", 0, 3, { kind: "note", note: "e3" })), "bass")).toContain("c2 . eb2 e3 . c2");
  });

  it("turns a rest into a note and a note into a rest", () => {
    const note = applied(setStepPitch(SONG, "bass", 0, 4, { kind: "note", note: "g3" }));
    expect(line(note, "bass")).toContain("c2 . eb2 c3 g3 c2 g1 .");
    expect(line(applied(setStepPitch(note, "bass", 0, 4, { kind: "rest" })), "bass")).toContain("c2 . eb2 c3 . c2 g1 .");
  });

  it("lengthens a note with a hold", () => {
    const held = applied(setStepPitch(SONG, "bass", 0, 1, { kind: "hold" }));
    expect(line(held, "bass")).toContain("bass  c2 ~ eb2");
    expectValid(held);
  });

  it("writes a chord and changes its quality, keeping the line's comment", () => {
    const fm7 = applied(setStepPitch(CHORDS, "pad", 0, 0, { kind: "chord", root: "F", quality: "m7" }));
    expect(line(fm7, "pad")).toBe("pad:   bass  Fm7 ~ ~ ~                // a chord held for the bar");
    const major = applied(setStepPitch(fm7, "pad", 0, 0, { kind: "chord", root: "Bb", quality: "major" }));
    expect(line(major, "pad")).toContain("bass  Bb ~ ~ ~");
  });

  it("splits a hits word around a note or a leading hold; a rest or hold fits in place", () => {
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 1, { kind: "note", note: "c2" }))).toBe("b: bass x c2 x.");
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 1, { kind: "hold" }))).toBe("b: bass x~x.");
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 0, { kind: "hold" }))).toBe("b: bass ~ .x.");
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 2, { kind: "rest" }))).toBe("b: bass x...");
  });

  it("refuses what the grammar cannot read, and steps outside the pattern", () => {
    expect(setStepPitch(SONG, "bass", 0, 0, { kind: "note", note: "h2" })).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setStepPitch(CHORDS, "pad", 0, 0, { kind: "chord", root: "c", quality: "m" })).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setStepPitch(SONG, "bass", 0, 8, { kind: "rest" })).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
    expect(setStepPitch(SONG, "lead", 0, 0, { kind: "rest" })).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });

  it("prints every pitch as the grammar writes it", () => {
    expect(pitchText({ kind: "chord", root: "C", quality: "maj7" })).toBe("Cmaj7");
    expect(pitchText({ kind: "chord", root: "D", quality: "major" })).toBe("D");
    expect(pitchText({ kind: "hold" })).toBe("~");
  });
});

describe("Scale lock (free)", () => {
  it("writes | free when the lock is off and removes it when it is on", () => {
    const free = applied(setTrackFree(SONG, "bass", true));
    expect(line(free, "bass")).toBe("bass:  bass  c2 . eb2 c3 . c2 g1 .   | cutoff 900 | free  // keep it dark");
    expect(applied(setTrackFree(free, "bass", true))).toBe(free);
    expect(applied(setTrackFree(free, "bass", false))).toBe(SONG);
    expectValid(free);
  });
});
