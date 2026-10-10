// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { AuditionView } from "@untzel/presentation/view-model";
import { track, viewFixture } from "../../testing/view-fixture";
import { auditionOf, rowActions } from "./library-sheet-actions";
const view = viewFixture();
const audition: AuditionView = { instrument: "acid", sound: "default", key: "a minor", pattern: null };
const bass = track("bass", "pitched");
function recorder() {
  const calls: string[] = [];
  const intents = {
    preview: (instrument: string) => calls.push(`preview ${instrument}`),
    stopPreview: () => calls.push("stop"),
    addTrack: (instrument: string) => (calls.push(`add ${instrument}`), instrument === "none" ? "" : "acid 2"),
    previewTrackSound: (name: string, instrument: string) => calls.push(`preview ${name} as ${instrument}`),
    endTrackPreview: () => calls.push("end preview"),
    setTrackSound: (name: string, instrument: string) => calls.push(`use ${instrument} on ${name}`),
  } as unknown as Parameters<typeof rowActions>[1];
  const callbacks = { onClose: () => calls.push("close"), onAdded: (name: string) => calls.push(`added ${name}`), onSoundChanged: (name: string) => calls.push(`changed ${name}`) };
  return { calls, intents, callbacks };
}
describe("auditionOf", () => {
  it("plays the library's audition when adding a track", () => {
    expect(auditionOf({ ...view, audition }, { kind: "add" })).toBe(audition);
  });
  it("plays the track's own preview when changing its sound", () => {
    expect(auditionOf(view, { kind: "replace", track: { ...bass, previewingSound: null } })).toBeNull();
    expect(auditionOf(view, { kind: "replace", track: { ...bass, previewingSound: { instrument: "acid", sound: "warm" } } })).toEqual({
      instrument: "acid",
      sound: "warm",
      key: view.transport.key,
      pattern: null,
    });
  });
});
describe("rowActions", () => {
  it("adds a track and says which, unless none was added", () => {
    const { calls, intents, callbacks } = recorder();
    const actions = rowActions({ kind: "add" }, intents, callbacks);
    actions.preview("acid", null, null);
    actions.choose("acid", null, null);
    actions.choose("none", null, null);
    actions.stop();
    expect(calls).toEqual(["preview acid", "add acid", "added acid 2", "add none", "stop"]);
  });
  it("changes the sound of the track shown, then goes back to it", () => {
    const { calls, intents, callbacks } = recorder();
    const actions = rowActions({ kind: "replace", track: bass }, intents, callbacks);
    actions.preview("acid", null, null);
    actions.choose("acid", null, null);
    actions.stop();
    expect(calls).toEqual(["preview bass as acid", "use acid on bass", "changed bass", "end preview"]);
  });
});
