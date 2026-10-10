// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { simRegistry } from "@untzel/sim/registry";
import { controlFor } from "./controls";

const { registry } = simRegistry();
const instrumentOf = (track: string): string | undefined => ({ kick: "kick", hat: "hat" })[track];

describe("controlFor", () => {
  it("maps grid, track and song gestures to the intents of the controls", () => {
    expect(controlFor({ kind: "toggleStep", track: "kick", bar: 0, step: 0 }, instrumentOf, registry)).toEqual({ kind: "intent", intent: "toggleStep" });
    expect(controlFor({ kind: "setTrackBars", track: "kick", bars: 2 }, instrumentOf, registry)).toEqual({ kind: "intent", intent: "setBars" });
    expect(controlFor({ kind: "addSectionMember", section: "a", track: "kick" }, instrumentOf, registry)).toEqual({
      kind: "intent",
      intent: "toggleSectionMember",
    });
    expect(controlFor({ kind: "renameTrack", track: "hat2", newName: "ride" }, instrumentOf, registry)).toEqual({ kind: "intent", intent: "renameTrack" });
    expect(controlFor({ kind: "drop" }, instrumentOf, registry)).toEqual({ kind: "intent", intent: "drop" });
  });

  it("uses the Tone knob for tone and a slider for manifest and mix parameters", () => {
    const set = (parameter: string) => ({ kind: "setParameter", track: "kick", parameter, value: 0.5 }) as const;
    expect(controlFor(set("tone"), instrumentOf, registry)).toEqual({ kind: "intent", intent: "setTone" });
    expect(controlFor(set("drive"), instrumentOf, registry)).toEqual({ kind: "intent", intent: "setParameter" });
    expect(controlFor(set("pan"), instrumentOf, registry)).toEqual({ kind: "intent", intent: "setParameter" });
  });

  it("falls back to Code where no intent exists yet", () => {
    const swing = { kind: "setParameter", track: "hat", parameter: "swing", value: 0.1 } as const;
    expect(controlFor(swing, instrumentOf, registry)).toEqual({ kind: "code", why: 'no slider for "swing"' });
    const typed = { kind: "typeCode", placement: { kind: "appendLine" }, text: "song a 4", reason: "song", pace: "keys" } as const;
    expect(controlFor(typed, instrumentOf, registry)).toEqual({ kind: "code", why: "song" });
  });
});
