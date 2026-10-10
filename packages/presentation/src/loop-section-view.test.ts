// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { captionSection, hintedTrack, isTrackMuted, trackPlayState } from "./loop-section-view";
import { sessionFixture } from "./testing/session-fixture";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
// The noise track is an effect outside the loop section, before the bass: the hint skips it.
const TEXT = `tempo 124
kick: kick x... x... x... x...
air: noise x~~~ ~~~~ ~~~~ ~~~~
bass: bass . . . c2 . . . . . . . . . . eb2 .
section groove kick | loop
section drop kick air bass
`;
function trackOf(view: SessionView, name: string) {
  const track = view.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no ${name}`);
  return track;
}
describe("trackPlayState", () => {
  it("reads not-in-section outside the loop section in loop mode, and the track's status otherwise", () => {
    const view = fixture.viewOf(TEXT);
    expect(trackPlayState(trackOf(view, "bass"), "loop")).toBe("not-in-section");
    expect(trackPlayState(trackOf(view, "kick"), "loop")).toBe("on");
    expect(trackPlayState(trackOf(view, "bass"), "song")).toBe("on");
  });
});
describe("isTrackMuted", () => {
  it("is pressed outside the loop section in loop mode, and not in song mode", () => {
    const view = fixture.viewOf(TEXT);
    expect(isTrackMuted(trackOf(view, "bass"), "loop")).toBe(true);
    expect(isTrackMuted(trackOf(view, "kick"), "loop")).toBe(false);
    expect(isTrackMuted(trackOf(view, "bass"), "song")).toBe(false);
  });
});
describe("captionSection", () => {
  it("names the loop section in loop mode and the song section in song mode", () => {
    const view = fixture.viewOf(TEXT);
    expect(captionSection(view, "drop")).toBe("groove");
    expect(captionSection({ ...view, mode: "song" }, "drop")).toBe("drop");
  });
});
describe("hintedTrack", () => {
  it("hints the first track outside the loop section that is not an effect, while the loop plays", () => {
    const { session } = fixture.sessionOf(TEXT);
    expect(hintedTrack(session.view(), fixture.registry)).toBeNull();
    session.play("loop");
    expect(hintedTrack(session.view(), fixture.registry)).toBe("bass");
    session.setMode("song");
    expect(hintedTrack(session.view(), fixture.registry)).toBeNull();
  });
});
