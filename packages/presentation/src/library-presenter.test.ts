// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { auditionView, libraryView } from "./library-presenter";
import { FAKE_DESCRIPTIONS, sessionFixture } from "./testing/session-fixture";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
const TEXT = "key a minor\nkick: kick x... x...\nhat: hat ..x. ..x.\nride: hat x.x. x.x.\n";
describe("libraryView", () => {
  const library = libraryView(fixture.viewOf(TEXT), fixture.registry, FAKE_DESCRIPTIONS);
  it("lists every instrument of the registry with how many tracks use it", () => {
    expect(library.map((entry) => [entry.instrument, entry.inSong])).toEqual([
      ["acid", 0],
      ["bass", 0],
      ["hat", 2],
      ["kick", 1],
      ["noise", 0],
      ["pad", 0],
    ]);
  });
  it("describes each instrument and sound with the descriptions it is given", () => {
    const noiseEntry = library.find((entry) => entry.instrument === "noise");
    expect(noiseEntry).toMatchObject({ group: "fx", kind: "drum", description: "noise: Filtered noise, white to wind", model: "PULSAR FX", range: null });
    expect(noiseEntry?.sounds[0]?.description).toBe("noise white: Bright white noise");
    expect(noiseEntry?.patterns).toEqual(["Whole bar", "Half bar", "Upbeat"]);
    expect(noiseEntry?.parameters).toEqual(["cutoff", "resonance", "color"]);
  });
});
describe("auditionView", () => {
  const view = fixture.viewOf(TEXT);
  it("is null without an audition", () => {
    expect(auditionView(null, view, fixture.registry)).toBeNull();
  });
  it("spells the default sound out and plays in the music's key", () => {
    expect(auditionView({ instrument: "bass", preset: null, pattern: "Offbeat" }, view, fixture.registry)).toEqual({
      instrument: "bass",
      sound: fixture.registry.get("bass")?.defaultPreset,
      key: "a minor",
      pattern: "Offbeat",
    });
    expect(auditionView({ instrument: "acid", preset: "squelch", pattern: null }, view, fixture.registry)?.sound).toBe("squelch");
  });
});
