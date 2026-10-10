// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { simRegistry } from "@untzel/sim/registry";
import { replayAction, replayActions } from "./replay";

const { registry } = simRegistry();

describe("replayAction", () => {
  it("adds a track with the Add track edit and checks the name it got", () => {
    expect(replayAction("", { kind: "addTrack", instrument: "kick", track: "kick", preset: null }, registry)).toEqual({
      ok: true,
      source: "kick: kick x... x... x... x...",
    });
    const taken = replayAction("kick: kick x...", { kind: "addTrack", instrument: "kick", track: "kick", preset: null }, registry);
    expect(taken).toEqual({ ok: false, reason: "NAME_MISMATCH" });
  });

  it("types a new line at the end of the text", () => {
    const action = { kind: "typeCode", placement: { kind: "appendLine" }, text: "tempo 124", reason: "global", pace: "keys" } as const;
    expect(replayAction("", action, registry)).toEqual({ ok: true, source: "tempo 124" });
    expect(replayAction("kick x...", action, registry)).toEqual({ ok: true, source: "kick x...\ntempo 124" });
  });

  it("types at the end of a track statement, before its comment", () => {
    const action = { kind: "typeCode", placement: { kind: "trackEnd", track: "kick" }, text: " | drive sine(4)", reason: "signal-value", pace: "keys" } as const;
    expect(replayAction("kick x... x...   // four on the floor\n", action, registry)).toEqual({
      ok: true,
      source: "kick x... x... | drive sine(4)   // four on the floor\n",
    });
  });

  it("types over the whole pattern of a track", () => {
    const action = { kind: "typeCode", placement: { kind: "trackPattern", track: "bass" }, text: "c2 ~ ~ .", reason: "sustain", pace: "keys" } as const;
    expect(replayAction("bass: bass c2 . . c2 / c2 . . . | cutoff 300", action, registry)).toEqual({
      ok: true,
      source: "bass: bass c2 ~ ~ . | cutoff 300",
    });
  });

  it("leaves the text as it is for transport actions", () => {
    expect(replayAction("kick x...", { kind: "togglePlay" }, registry)).toEqual({ ok: true, source: "kick x..." });
    expect(replayAction("kick x...", { kind: "setMode", mode: "song" }, registry)).toEqual({ ok: true, source: "kick x..." });
  });
});

describe("replayActions", () => {
  it("stops at the first action that fails and says which", () => {
    const result = replayActions(
      "",
      [
        { kind: "addTrack", instrument: "kick", track: "kick", preset: null },
        { kind: "toggleStep", track: "snare", bar: 0, step: 0 },
      ],
      registry,
    );
    expect(result).toEqual({ ok: false, reason: "UNKNOWN_TRACK", failedAt: 1 });
  });
});
