// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { germanNote, nearestOctave, noteFix, respelledNote } from "./note-spelling";

describe("what a written note that is not one meant", () => {
  it.each([
    ["C2", "c2"],
    ["Eb2", "eb2"],
    ["F#1", "f#1"],
    ["c 2", "c2"],
    ["C 2", "c2"],
    ["c2", null],
    ["H2", null],
    ["G9", "g9"],
    ["A9", null],
  ])("%s is spelled %s", (text, note) => {
    expect(respelledNote(text)).toBe(note);
  });

  it("reads H as B, the German name, and nothing else as a note", () => {
    expect(germanNote("h2")).toBe("b2");
    expect(germanNote("hb2")).toBeNull();
    expect(germanNote("x2")).toBeNull();
  });

  it("moves an octave above MIDI 127 to the nearest one that exists", () => {
    expect(nearestOctave("b9")).toBe("b8");
    expect(nearestOctave("g#9")).toBe("g#8");
    expect(nearestOctave("g9")).toBeNull();
  });

  it("the German H waits for the person; the octave clamp is safe", () => {
    expect(noteFix({ text: "h2", from: 0, to: 2 })).toMatchObject({ suggestion: "b2", fix: { safe: false } });
    expect(noteFix({ text: "b9", from: 0, to: 2 })).toMatchObject({ suggestion: null, fix: { safe: true, title: "Change to b8" } });
    expect(noteFix({ text: "x2", from: 0, to: 2 })).toEqual({ suggestion: null, fix: null });
  });
});
