// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { sessionFixture } from "./testing/session-fixture";
import { noteSpanOf, trackControlsFields } from "./track-controls-view";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
function trackOf(view: SessionView, name: string) {
  const track = view.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no ${name}`);
  return track;
}
function fieldsOf(source: string, name: string) {
  const view = fixture.viewOf(source);
  return trackControlsFields(trackOf(view, name), fixture.registry, view);
}
describe("trackControlsFields", () => {
  it("names open as setting the tone of a hat", () => {
    expect(fieldsOf("ride: hat x.x. | open 0.7\n", "ride").toneSetBy).toEqual([{ parameter: "open", isSignal: false }]);
    expect(fieldsOf("ride: hat x.x.\n", "ride")).toMatchObject({ toneSetBy: [], hasTone: true });
  });
  it("names the pattern the text plays in the music's key", () => {
    expect(fieldsOf("key a minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass").currentPattern).toBe("Offbeat");
    expect(fieldsOf("key c minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass").currentPattern).toBeNull();
  });
  it("says what the pattern plays and the parameters written", () => {
    const fields = fieldsOf("bass: bass c2 . . eb2 | cutoff 900 | gain 0.5\n", "bass");
    expect(fields.content).toEqual(["notes"]);
    expect(fields.writtenParameters).toEqual(["cutoff"]);
    expect(fields.patterns).toEqual(fixture.registry.get("bass")?.patterns.map((pattern) => pattern.name));
    expect(fields).toMatchObject({ previewing: null, previewingSound: null });
  });
  it("shows a Change sound preview as the instrument and sound playing", () => {
    const { session } = fixture.sessionOf("bass: bass c2 . . c2\n");
    session.previewTrack("bass", "bass: acid squelch c2 . . c2\n", "acid · squelch");
    const view = session.view();
    expect(trackControlsFields(trackOf(view, "bass"), fixture.registry, view)).toMatchObject({ previewing: "acid · squelch", previewingSound: { instrument: "acid", sound: "squelch" } });
  });
});
describe("noteSpanOf", () => {
  it("is the lowest and highest note written, chords by their notes, and null for hits", () => {
    expect(noteSpanOf(trackOf(fixture.viewOf("bass: bass c2 . . eb2\n"), "bass"))).toEqual({ lowest: 36, highest: 39 });
    expect(noteSpanOf(trackOf(fixture.viewOf("pad: pad Cm ~ ~ ~\n"), "pad"))).toEqual({ lowest: 48, highest: 55 });
    expect(noteSpanOf(trackOf(fixture.viewOf("kick: kick x... x...\n"), "kick"))).toBeNull();
  });
});
