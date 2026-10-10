// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Key } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { patternInKey } from "./pattern-key";

const A_MINOR: Key = { tonic: 9, scale: "minor" };
const D_DORIAN: Key = { tonic: 2, scale: "dorian" };
const F_SHARP_MINOR: Key = { tonic: 6, scale: "minor" };
const C_SHARP_MINOR: Key = { tonic: 1, scale: "minor" };

describe("patternInKey", () => {
  it("moves notes to the tonic by the shortest way", () => {
    expect(patternInKey("c2 . . c2", "pitched", A_MINOR)).toBe("a1 . . a1");
    expect(patternInKey("eb2", "pitched", F_SHARP_MINOR)).toBe("a1");
  });

  it("renames chord roots and keeps the quality and every other byte", () => {
    expect(patternInKey("Cm7 ~ ~ ~", "chord", A_MINOR)).toBe("Am7 ~ ~ ~");
    expect(patternInKey("Cm ~ / Ab ~ Bb ~", "chord", C_SHARP_MINOR)).toBe("C#m ~ / A ~ B ~");
    expect(patternInKey(". Cm7! . . [Cm7 .]*2 Cm7?0.5", "chord", A_MINOR)).toBe(". Am7! . . [Am7 .]*2 Am7?0.5");
  });

  it("moves every note of a stack", () => {
    expect(patternInKey("c3+eb3+g3", "chord", D_DORIAN)).toBe("d3+f3+a3");
  });

  it("leaves drums, a null key and c minor unchanged", () => {
    expect(patternInKey("x... x...", "drum", A_MINOR)).toBe("x... x...");
    expect(patternInKey("c2 . . c2", "pitched", null)).toBe("c2 . . c2");
    expect(patternInKey("c2 . . c2", "pitched", { tonic: 0, scale: "major" })).toBe("c2 . . c2");
  });

  it("is null when a note leaves the writable range or the text does not parse", () => {
    expect(patternInKey("c0 . . c0", "pitched", { tonic: 11, scale: "minor" })).toBeNull();
    expect(patternInKey("c2 | gain 1", "pitched", A_MINOR)).toBeNull();
    expect(patternInKey("c2 ((", "pitched", A_MINOR)).toBeNull();
  });

  it("documents the mixed case outside the contract: a chord's root has no octave, a note keeps its own", () => {
    // Manifest patterns never mix chords and notes (instruments.test.ts refuses it): here
    // the note an octave over the root of Cm7 (48 and 60) lands on the root of Am7 (57 and 57).
    expect(patternInKey("Cm7 . c4 .", "chord", A_MINOR)).toBe("Am7 . a3 .");
  });
});
