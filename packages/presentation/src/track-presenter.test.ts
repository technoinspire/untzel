// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { FAKE_DESCRIPTIONS, FAKE_LABELS, sessionFixture } from "./testing/session-fixture";
import { UNRANGED_PITCH_RANGE, stepView, trackView } from "./track-presenter";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
const WORDS = { labels: FAKE_LABELS, descriptions: FAKE_DESCRIPTIONS };
const TEXT = `tempo 124
kick: kick x... x... x... x... / X... x... x... x...
bass: bass . c2 . eb2 | pan -0.3
pad: pad Cm7 ~ ~ ~
`;
function trackOf(view: SessionView, name: string) {
  const track = view.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no ${name}`);
  return track;
}
function presented(name: string, now: Parameters<typeof trackView>[2] = null, hinted: string | null = null) {
  const view = fixture.viewOf(TEXT);
  return trackView(trackOf(view, name), fixture.registry, now, view, hinted, WORDS);
}
describe("stepView", () => {
  it("names notes, keeps a chord as written and reads a sustain as a hold", () => {
    const view = fixture.viewOf(TEXT);
    expect(trackOf(view, "bass").bars[0]?.map((step) => stepView(step, view.source))).toEqual([
      { kind: "rest", label: null },
      { kind: "note", label: "c2" },
      { kind: "rest", label: null },
      { kind: "note", label: "eb2" },
    ]);
    expect(trackOf(view, "pad").bars[0]?.map((step) => stepView(step, view.source))).toEqual([
      { kind: "chord", label: "Cm7" },
      { kind: "hold", label: null },
      { kind: "hold", label: null },
      { kind: "hold", label: null },
    ]);
  });
});
describe("trackView", () => {
  it("takes the group, kind and note range from the manifest; a drum gets the unranged keyboard", () => {
    expect(presented("bass")).toMatchObject({ name: "bass", group: "bass", kind: "pitched", pitchRange: fixture.registry.get("bass")?.range, isScaleLocked: true });
    expect(presented("kick")).toMatchObject({ group: "drums", kind: "drum", pitchRange: UNRANGED_PITCH_RANGE, bars: 2 });
  });
  it("shows the bar playing on the pattern's own cycle, and the hint", () => {
    const now = { patternBar: 5, elapsed: 0, fraction: 0, bar: 5 };
    expect(presented("kick", now, "kick")).toMatchObject({ playingBar: 1, isHinted: true });
    expect(presented("kick")).toMatchObject({ playingBar: null, isHinted: false });
  });
  it("writes the sliders and sounds with the words it is given", () => {
    const track = presented("bass");
    expect(track.mix.find((row) => row.name === "pan")?.display).toBe("left 30");
    expect(track.presets[0]?.description).toMatch(/^bass /);
    expect(track.preset).toBe(fixture.registry.get("bass")?.defaultPreset);
    expect(track.currentPattern).toBeNull();
  });
});
