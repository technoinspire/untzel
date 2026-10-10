// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { lightSourceHash, productionHeader, stagePlanHash, stripMuteModifiers } from "./light-source";

const SONG = `tempo 124
key a minor
kick: kick deep x... x... x... x...
hat: hat closed .x.x .x.x | gain 0.6
section drop kick hat`;

describe("stripMuteModifiers", () => {
  it.each([
    ["kick: kick deep x... | mute | gain 0.9", "kick: kick deep x... | gain 0.9"],
    ["hat:  hat closed x.x. | gain 0.6 | mute", "hat:  hat closed x.x. | gain 0.6"],
    ["hat: hat closed x.x. | mute // keep | mute here", "hat: hat closed x.x. // keep | mute here"],
    ["section drop kick hat | loop", "section drop kick hat | loop"],
  ])("%s", (line, expected) => {
    expect(stripMuteModifiers(line)).toBe(expected);
  });
});

describe("the light's hashes", () => {
  it("ignore | mute and comments", () => {
    const muted = SONG.replace("x... x... x... x...", "x... x... x... x... | mute");
    expect(lightSourceHash(muted)).toBe(lightSourceHash(SONG));
    expect(lightSourceHash(`${SONG}\n// a note`)).toBe(lightSourceHash(SONG));
    expect(stagePlanHash(muted)).toBe(stagePlanHash(SONG));
  });

  it("follow any other edit; the stage plan only the production's header", () => {
    const edited = SONG.replace("| gain 0.6", "| gain 0.5");
    expect(lightSourceHash(edited)).not.toBe(lightSourceHash(SONG));
    expect(stagePlanHash(edited)).toBe(stagePlanHash(SONG));
    expect(stagePlanHash(SONG.replace("tempo 124", "tempo 128"))).not.toBe(stagePlanHash(SONG));
  });

  it("keep only the header lines", () => {
    expect(productionHeader("tempo 124\nkick: kick x...\nsection drop kick\nsong drop*4")).toBe("tempo 124\nsong drop*4");
  });
});
