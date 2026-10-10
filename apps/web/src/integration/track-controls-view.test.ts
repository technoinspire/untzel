// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// An integration test of the composition: the presenters of @untzel/presentation over the
// app's registry, which a package may not import.

import { analyze } from "@untzel/language";
import { Session } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { trackControlsFields } from "@untzel/presentation";

const { registry } = buildRegistry();

function viewOf(source: string) {
  const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze: (text) => analyze(text, registry) });
  session.applyText(source);
  return { session, view: session.view() };
}

function fieldsOf(source: string, track: string) {
  const { view } = viewOf(source);
  const found = view.tracks.find((entry) => entry.name === track);
  if (found === undefined) throw new Error(track);
  return trackControlsFields(found, registry, view);
}

describe("trackControlsFields", () => {
  it("names open as setting the tone of a hat", () => {
    expect(fieldsOf("ride: hat x.x. | open 0.7\n", "ride").toneSetBy).toEqual([{ parameter: "open", isSignal: false }]);
    expect(fieldsOf("ride: hat x.x.\n", "ride").toneSetBy).toEqual([]);
  });

  it("finds the chip the text plays in the music's key, and none after the key changed", () => {
    expect(fieldsOf("key a minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass").currentPattern).toBe("Offbeat");
    expect(fieldsOf("key c minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass").currentPattern).toBeNull();
    expect(fieldsOf("kick: kick   x... x...   x... x...\n", "kick").currentPattern).toBe("Four on the floor");
  });

  it("says what the pattern plays, its note span and the parameters written", () => {
    const fields = fieldsOf("bass: bass c2 . . eb2 | cutoff 900 | gain 0.5\n", "bass");
    expect(fields.content).toEqual(["notes"]);
    expect(fields.noteSpan).toEqual({ lowest: 36, highest: 39 });
    expect(fields.writtenParameters).toEqual(["cutoff"]);
    expect(fields.patterns[0]).toBe("Dotted");
  });

  it("shows a Change sound preview as the instrument and sound playing", () => {
    const { session } = viewOf("bass: bass c2 . . c2\n");
    session.previewTrack("bass", "bass: acid squelch c2 . . c2\n", "acid · squelch");
    const view = session.view();
    const bass = view.tracks[0];
    if (bass === undefined) throw new Error("bass");
    expect(trackControlsFields(bass, registry, view)).toMatchObject({ previewing: "acid · squelch", previewingSound: { instrument: "acid", sound: "squelch" } });
  });
});
