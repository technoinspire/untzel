// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { track } from "../../testing/view-fixture";
import { audibleBars, barThumbStates, canPasteBar, loopReachNote } from "./bar-thumb-state";

describe("barThumbStates", () => {
  it("keeps the bar being edited and the bar playing apart", () => {
    const states = barThumbStates(track("kick", "drum", 4, 2), 1);
    expect(states.map((state) => state.label)).toEqual(["1", "2 · editing", "3", "4"]);
    expect(states.map((state) => state.isEditing)).toEqual([false, true, false, false]);
    expect(states.map((state) => state.isPlaying)).toEqual([false, false, true, false]);
    expect(states[0]?.name).toBe("Bar 1");
  });

  it("marks nothing as playing when stopped", () => {
    expect(barThumbStates(track("kick", "drum", 2, null), 0).some((state) => state.isPlaying)).toBe(false);
  });
});

// 'loop 2' over a 4-bar kick restarts the pattern every pass, so
// bars 3 and 4 never sound; the detail must say so instead of letting them be edited
// unheard. Nothing here touches the text.
describe("bars a shorter written loop never reaches", () => {
  const loop = (loopBars: number, loopBarsSounding: number | null = null) => ({ mode: "loop" as const, loopBars, loopBarsSounding });

  it("counts the bars that play: the shorter of pattern and loop, every bar in song mode", () => {
    expect(audibleBars(4, loop(2))).toBe(2);
    expect(audibleBars(4, loop(8))).toBe(4);
    expect(audibleBars(4, loop(4, 2))).toBe(2);
    expect(audibleBars(4, { mode: "song", loopBars: 2, loopBarsSounding: null })).toBe(4);
  });

  it("dims and names the bars past the loop, keeping editing and playing apart", () => {
    const states = barThumbStates(track("kick", "drum", 4, 1), 2, 2);
    expect(states.map((state) => state.isAudible)).toEqual([true, true, false, false]);
    expect(states.map((state) => state.name)).toEqual(["Bar 1", "Bar 2", "Bar 3, not in the loop", "Bar 4, not in the loop"]);
    expect(states[2]?.isEditing).toBe(true);
    expect(states[1]?.isPlaying).toBe(true);
  });

  it("says which bars the loop plays, and nothing when every bar plays", () => {
    expect(loopReachNote(4, 2)).toBe("Loop plays bars 1–2 only");
    expect(loopReachNote(4, 1)).toBe("Loop plays bar 1 only");
    expect(loopReachNote(4, 4)).toBeNull();
    expect(barThumbStates(track("kick", "drum", 2), 0).every((state) => state.isAudible)).toBe(true);
  });
});

describe("canPasteBar", () => {
  const kick = track("kick", "drum", 4);
  it("pastes a drum bar into another bar or another drum track", () => {
    const copied = { track: "kick", bar: 0, kind: "drum" as const };
    expect(canPasteBar(copied, kick, 2)).toBe(true);
    expect(canPasteBar(copied, track("hat", "drum"), 0)).toBe(true);
  });

  it("refuses with nothing copied, into the same bar, or across drum and pitched", () => {
    expect(canPasteBar(null, kick, 1)).toBe(false);
    expect(canPasteBar({ track: "kick", bar: 1, kind: "drum" }, kick, 1)).toBe(false);
    expect(canPasteBar({ track: "kick", bar: 1, kind: "drum" }, track("bass", "pitched"), 0)).toBe(false);
  });
});
