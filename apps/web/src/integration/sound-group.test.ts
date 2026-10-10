// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sound group of the track detail over the real session and language: picking a
// sound and adding or removing an effect are one edit each, and the view shows them.
// An integration test of the composition: the presenters of @untzel/presentation over the
// app's registry, which a package may not import.
import { analyze } from "@untzel/language";
import { Session, SoundEdits } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { effectViews, presetViews } from "@untzel/presentation";
import { PRESENTATION_COPY } from "../adapters/presentation-copy";
import { languageSoundEditor } from "../adapters/source-editor";

const { registry } = buildRegistry();

function setup(source: string) {
  const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze: (text) => analyze(text, registry) });
  session.applyText(source);
  return { session, edits: new SoundEdits(session, languageSoundEditor(registry)) };
}

const lineOf = (session: Session, name: string): string => session.state().source.split("\n").find((line) => line.startsWith(`${name}:`)) ?? "";

describe("sound group", () => {
  it("picks a sound, then the default again, each as one edit", () => {
    const { session, edits } = setup("tempo 124\nkeys: piano c3 eb3 g3 .\n");
    expect(edits.setSound("keys", "felt")).toEqual({ ok: true });
    expect(lineOf(session, "keys")).toBe("keys: piano felt c3 eb3 g3 .");
    expect(session.view().tracks[0]?.preset).toBe("felt");
    expect(edits.setSound("keys", null)).toEqual({ ok: true });
    expect(lineOf(session, "keys")).toBe("keys: piano c3 eb3 g3 .");
    expect(edits.setSound("lead", null)).toEqual({ ok: false, code: "UNKNOWN_TRACK" });
  });

  it("adds and removes effects; the view lists them in chain order with their sliders", () => {
    const { session, edits } = setup("tempo 124\nkeys: piano c3 | lowpass 900\n");
    expect(edits.addEffect("keys", "eq")).toEqual({ ok: true });
    const track = session.view().tracks[0];
    if (track === undefined) throw new Error("no track");
    const views = effectViews(track, PRESENTATION_COPY.labels);
    expect(views.map((view) => view.effect)).toEqual(["lowpass", "eq"]);
    expect(views[1]?.parameters.map((parameter) => parameter.name)).toEqual(["eq-low", "eq-mid", "eq-mid-freq", "eq-high"]);
    expect(views[0]?.parameters[0]?.display).toBe("900 Hz");
    expect(edits.removeEffect("keys", "lowpass")).toEqual({ ok: true });
    expect(lineOf(session, "keys")).toBe("keys: piano c3 | eq-high 2");
    expect(edits.addEffect("keys", "reverb")).toEqual({ ok: false, code: "INVALID_NAME" });
  });

  it("lists the instrument's sounds with the default first", () => {
    const piano = registry.get("piano");
    expect(presetViews(piano, PRESENTATION_COPY.descriptions)[0]?.name).toBe(piano?.defaultPreset);
    expect(presetViews(undefined, PRESENTATION_COPY.descriptions)).toEqual([]);
  });
});
