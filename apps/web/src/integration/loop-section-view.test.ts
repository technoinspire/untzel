// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// An integration test of the composition: the presenters of @untzel/presentation over the
// app's registry and the template tree of @untzel/sim, which a package may not import.
import { fileURLToPath } from "node:url";
import { firstTouchTemplate, readTemplateTree } from "@untzel/sim/template-tree";
import { analyze } from "@untzel/language";
import { Session, type SessionView } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { captionSection, hintedTrack, isTrackMuted, trackPlayState } from "@untzel/presentation";

const { registry } = buildRegistry();
// The loop-section cases read the first-touch template (Midnight Bloom), found by its `// default: true`.
const onboard = firstTouchTemplate(readTemplateTree(fileURLToPath(new URL("../../../../", import.meta.url)))).text;

function sessionWith(source: string): Session {
  const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze: (text) => analyze(text, registry) });
  session.applyText(source);
  return session;
}

const trackOf = (view: SessionView, name: string) => {
  const track = view.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no ${name}`);
  return track;
};

describe("the loop section on the track blocks", () => {
  it("a track outside the loop section reads not-in-section in loop mode, and is off-or-on in song mode", () => {
    const view = sessionWith(onboard).view();
    expect(view.loopSection).toBe("groove");
    expect(trackOf(view, "pluck").inLoopSection).toBe(false);
    expect(trackPlayState(trackOf(view, "pluck"), "loop")).toBe("not-in-section");
    expect(trackPlayState(trackOf(view, "kick"), "loop")).toBe("on");
    expect(trackPlayState(trackOf(view, "pluck"), "song")).toBe("on");
  });

  it("captions name the loop section in loop mode and the song section in song mode", () => {
    const view = sessionWith(onboard).view();
    expect(captionSection(view, "drop")).toBe("groove");
    const songView: SessionView = { ...view, mode: "song" };
    expect(captionSection(songView, "drop")).toBe("drop");
  });

  it("hints the pluck while the onboard loop plays: the first block outside the loop that is not an effect", () => {
    const session = sessionWith(onboard);
    expect(hintedTrack(session.view(), registry)).toBeNull();
    session.play("loop");
    expect(hintedTrack(session.view(), registry)).toBe("pluck");
    session.setMode("song");
    expect(hintedTrack(session.view(), registry)).toBeNull();
  });

  it("hints nothing without a loop section", () => {
    const session = sessionWith("tempo 124\nkick: kick x...\npad: pad Cm ~ ~ ~\n");
    session.play("loop");
    expect(session.view().loopSection).toBeNull();
    expect(hintedTrack(session.view(), registry)).toBeNull();
  });
});

describe("isTrackMuted (the pressed M must show)", () => {
  it("reads muted for a track outside the loop section in loop mode, and not for one inside", () => {
    const view = sessionWith(onboard).view();
    expect(view.loopSection).toBe("groove");
    // pluck is not a member of the groove loop section, so Mute reads pressed in loop mode.
    expect(isTrackMuted(trackOf(view, "pluck"), "loop")).toBe(true);
    expect(isTrackMuted(trackOf(view, "kick"), "loop")).toBe(false);
  });

  it("in song mode, being outside the playing section is not a mute", () => {
    const view = sessionWith(onboard).view();
    expect(isTrackMuted(trackOf(view, "pluck"), "song")).toBe(false);
  });
});
