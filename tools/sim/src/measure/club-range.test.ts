// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The club range: pure checks on synthetic spectra and
// stems, no WASM.
import { describe, expect, it } from "vitest";
import { clubBalance, clubShape, clubViolations, familyOf, kWeightedPower, type StemPower } from "./club-range";
import { THIRD_OCTAVE_CENTERS } from "./ltas";
import { sectionTracks, soloText } from "../templates/template-stems";

/** Third-octave levels whose per-Hz slope is `psdSlope` dB per octave. */
const sloped = (psdSlope: number): number[] => THIRD_OCTAVE_CENTERS.map((centre) => (psdSlope + 3) * Math.log2(centre / 1000) - 4.77);
const stem = (track: string, instrument: string, group: Parameters<typeof familyOf>[1], power: number): StemPower => ({ track, instrument, family: familyOf(instrument, group), power });

describe("club shape", () => {
  it("reads the per-Hz tilt and no deviation on the club line", () => {
    const shape = clubShape(sloped(-4.5));
    expect(shape.psdTiltDbPerOctave).toBeCloseTo(-4.5, 1);
    expect(shape.deviationDb).toBeLessThan(0.2);
  });
  it("flags a dark mix and a boxy octave", () => {
    const dark = clubShape(sloped(-8));
    expect(clubViolations("t", dark, clubBalance([])).join("\n")).toMatch(/PSD tilt -(7\.9|8\.0)/);
    const boxy = sloped(-4.5).map((level, i) => (THIRD_OCTAVE_CENTERS[i] === 500 ? level + 12 : level));
    expect(clubViolations("t", clubShape(boxy), clubBalance([])).join("\n")).toMatch(/500 Hz is \d/);
  });
});

describe("club balance", () => {
  const club = [stem("kick", "kick", "drums", 1), stem("sub", "sub", "bass", 0.6), stem("hat", "hat", "drums", 0.12), stem("pad", "pad", "pads", 0.3)];
  it("passes kick and bass on top, the pad under the kick and the hats at about −12 dB", () => {
    const violations = clubViolations("t", clubShape(sloped(-4.5)), clubBalance(club));
    expect(violations).toEqual([]);
  });
  it("flags a pad over the kick, a bass under the pads and missing hats", () => {
    const loudPad = [stem("kick", "kick", "drums", 1), stem("sub", "sub", "bass", 0.2), stem("hat", "hat", "drums", 0.001), stem("pad", "pad", "pads", 2)];
    const text = clubViolations("t", clubShape(sloped(-4.5)), clubBalance(loudPad)).join("\n");
    expect(text).toMatch(/not kick and bass/);
    expect(text).toMatch(/pad is louder than the kick/);
    expect(text).toMatch(/hats, shaker and ride take/);
  });
  it("weights a 1 kHz tone above a 40 Hz tone of the same level (K-weighting)", () => {
    const tone = (hz: number) => Float32Array.from({ length: 48_000 }, (_, n) => Math.sin((2 * Math.PI * hz * n) / 48_000));
    expect(kWeightedPower(tone(1000), tone(1000), 48_000)).toBeGreaterThan(4 * kWeightedPower(tone(40), tone(40), 48_000));
  });
});

describe("template stems", () => {
  const song = "tempo 120\nk: kick x...\nb: sub c1 ~ ~ ~\nh: hat ..x.\nsection a k h\nsection b k b h | loop\n";
  it("lists the tracks of a section and solos one, as the loop", () => {
    expect(sectionTracks(song, "b")).toEqual(["k", "b", "h"]);
    expect(soloText(song, "b", "b")).toContain("section b b | loop");
    expect(soloText(song, "b", "b")).toContain("section a k h\n");
  });
  it("comments the other tracks out of a text without sections", () => {
    const loop = "tempo 120\nk: kick x...\nh: hat ..x.\n";
    expect(sectionTracks(loop, null)).toEqual(["k", "h"]);
    expect(soloText(loop, null, "h")).toBe("tempo 120\n// k: kick x...\nh: hat ..x.\n");
  });
});
