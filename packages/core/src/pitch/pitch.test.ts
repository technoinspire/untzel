// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import {
  chordNameToMidis,
  midiToNoteName,
  noteNameToMidi,
  pitchClassName,
  quantizeToScale,
  scalePitchClasses,
  tonicToPitchClass,
  transposeFromC,
} from "./pitch";

describe("pitch names", () => {
  it("maps notes with c4 = 60", () => {
    expect(noteNameToMidi("c4")).toBe(60);
    expect(noteNameToMidi("c1")).toBe(24);
    expect(noteNameToMidi("c2")).toBe(36);
    expect(noteNameToMidi("eb2")).toBe(39);
    expect(noteNameToMidi("f#1")).toBe(30);
    expect(noteNameToMidi("g9")).toBe(127);
    for (const invalid of ["h2", "g#9", "c", "C4", "c10", "cb"]) {
      expect(noteNameToMidi(invalid)).toBeNull();
    }
  });

  it("writes midi back as the note the grammar reads", () => {
    expect(pitchClassName(3)).toBe("eb");
    expect(pitchClassName(-1)).toBe("b");
    expect(midiToNoteName(24)).toBe("c1");
    expect(midiToNoteName(39)).toBe("eb2");
    expect(midiToNoteName(127)).toBe("g9");
    for (const midi of [11, 128, 3.5]) expect(midiToNoteName(midi)).toBeNull();
    for (let midi = 12; midi <= 127; midi += 1) {
      expect(noteNameToMidi(midiToNoteName(midi) ?? "")).toBe(midi);
    }
  });
  it("maps tonics to pitch classes", () => {
    expect(tonicToPitchClass("c")).toBe(0);
    expect(tonicToPitchClass("eb")).toBe(3);
    expect(tonicToPitchClass("f#")).toBe(6);
    expect(tonicToPitchClass("cb")).toBe(11);
    expect(tonicToPitchClass("h")).toBeNull();
  });

  it("voices chords in root position from octave 3", () => {
    expect(chordNameToMidis("C")).toEqual([48, 52, 55]);
    expect(chordNameToMidis("Cm7")).toEqual([48, 51, 55, 58]);
    expect(chordNameToMidis("Abmaj7")).toEqual([56, 60, 63, 67]);
    expect(chordNameToMidis("Gsus4")).toEqual([55, 60, 62]);
    expect(chordNameToMidis("F#dim")).toEqual([54, 57, 60]);
    expect(chordNameToMidis("Bb7")).toEqual([58, 62, 65, 68]);
    expect(chordNameToMidis("Dsus2")).toEqual([50, 52, 57]);
    expect(chordNameToMidis("Em")).toEqual([52, 55, 59]);
    expect(chordNameToMidis("Cb")).toEqual([59, 63, 66]);
    expect(chordNameToMidis("cm7")).toBeNull();
    expect(chordNameToMidis("Cmaj13")).toBeNull();
    expect(chordNameToMidis("Cm9")).toEqual([48, 51, 55, 58, 62]);
    expect(chordNameToMidis("Am7b5")).toEqual([57, 60, 63, 67]);
  });
});

describe("quantizeToScale", () => {
  const cMinor = { tonic: 0, scale: "minor" } as const;

  it("keeps notes of the scale", () => {
    for (const midi of [36, 38, 39, 41, 43, 44, 46]) expect(quantizeToScale(midi, cMinor)).toBe(midi);
  });

  it("moves to the nearest degree, ties down", () => {
    // e (40) lies between eb (39) and f (41): tie goes down.
    expect(quantizeToScale(40, cMinor)).toBe(39);
    // c# (37) lies between c (36) and d (38): tie goes down.
    expect(quantizeToScale(37, cMinor)).toBe(36);
    // b (47): c (48) is one semitone up, bb (46) one down: tie goes down.
    expect(quantizeToScale(47, cMinor)).toBe(46);
    expect(quantizeToScale(42, { tonic: 0, scale: "major" })).toBe(41);
  });

  it("follows the tonic", () => {
    // a minor: a b c d e f g. c# (61) -> c (60).
    expect(quantizeToScale(61, { tonic: 9, scale: "minor" })).toBe(60);
  });

  it("leaves chromatic untouched", () => {
    for (let midi = 0; midi < 128; midi += 1) {
      expect(quantizeToScale(midi, { tonic: 0, scale: "chromatic" })).toBe(midi);
    }
  });
});

describe("scalePitchClasses", () => {
  it("lists the degrees from the tonic, wrapping at the octave", () => {
    expect(scalePitchClasses({ tonic: 0, scale: "minor" })).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(scalePitchClasses({ tonic: 9, scale: "major" })).toEqual([9, 11, 1, 2, 4, 6, 8]);
  });
});

describe("transposeFromC", () => {
  it("moves from c to the tonic by the shortest way, −6..+5", () => {
    expect([0, 2, 5, 6, 9, 11].map(transposeFromC)).toEqual([0, 2, 5, -6, -3, -1]);
    expect(transposeFromC(-3)).toBe(-3);
  });
});
