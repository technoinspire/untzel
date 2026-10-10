// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PlaybackMode, SessionView } from "@untzel/session";
import { TICKS_PER_BAR } from "@untzel/session/rules";
import { describe, expect, it } from "vitest";
import { ExportListening, type ListeningSession } from "./export-listening";

function fakeSession() {
  let listener: ((view: SessionView) => void) | null = null;
  let view = { playing: false, position: null } as unknown as SessionView;
  const calls: string[] = [];
  const session: ListeningSession = {
    view: () => view,
    subscribe: (next) => {
      listener = next;
      return () => (listener = null);
    },
    stop: () => {
      calls.push("stop");
      view = { ...view, playing: false } as SessionView;
    },
    playFromBar: (mode: PlaybackMode, bar: number) => {
      calls.push(`play ${mode} ${bar}`);
      return { ok: true };
    },
  };
  const at = (mode: PlaybackMode, bar: number) => {
    view = { playing: true, position: { mode, bar, loopBar: mode === "loop" ? bar : null } } as unknown as SessionView;
    listener?.(view);
  };
  const stoppedElsewhere = () => {
    view = { playing: false, position: null } as unknown as SessionView;
    listener?.(view);
  };
  return { session, calls, at, stoppedElsewhere };
}

describe("ExportListening", () => {
  const stretch = { mode: "song" as const, startTick: 8 * TICKS_PER_BAR + 16, endTick: 12 * TICKS_PER_BAR };

  it("plays from the stretch's first bar and stops once the music passes its last", () => {
    const { session, calls, at } = fakeSession();
    const listening = new ExportListening(session, () => undefined);
    listening.toggle(stretch);
    expect(calls).toEqual(["play song 8"]);
    at("song", 30); // the old play's last position: ignored until the new play reports bar 8
    at("song", 8);
    at("song", 11);
    expect(listening.isListening).toBe(true);
    at("song", 12);
    expect(calls).toEqual(["play song 8", "stop"]);
    expect(listening.isListening).toBe(false);
  });

  it("stops when a loop wraps back before the stretch ends", () => {
    const { session, calls, at } = fakeSession();
    const listening = new ExportListening(session, () => undefined);
    listening.toggle({ mode: "loop", startTick: 2 * TICKS_PER_BAR, endTick: 8 * TICKS_PER_BAR });
    at("loop", 2);
    at("loop", 5);
    at("loop", 0);
    expect(calls.at(-1)).toBe("stop");
  });

  it("stops on a second press, and forgets a play stopped elsewhere", () => {
    const { session, calls, at, stoppedElsewhere } = fakeSession();
    const listening = new ExportListening(session, () => undefined);
    listening.toggle(stretch);
    listening.toggle(stretch);
    expect(calls).toEqual(["play song 8", "stop"]);
    listening.toggle(stretch);
    at("song", 8);
    stoppedElsewhere();
    expect(listening.isListening).toBe(false);
    expect(calls.filter((call) => call === "stop")).toHaveLength(1);
  });
});
