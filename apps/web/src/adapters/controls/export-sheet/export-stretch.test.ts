// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { ExportStretchState } from "./export-stretch";

/** A 16-bar loop at 120 BPM: 2 s a bar, 32 s in all. */
const program = { ...fakeProgram([fakeTrack("kick")], { tempo: 120 }), loopBars: 16 };
const loop = (range: { startBar: number; endBar: number } | null) => ({ mode: "loop" as const, range });

describe("the export sheet's stretch", () => {
  it("starts as a copy of the play range, or the whole loop", () => {
    const state = new ExportStretchState();
    state.sync(program, loop(null), 600);
    expect(state.stretch).toEqual({ startTick: 0, endTick: 1024 });
    state.sync(program, loop({ startBar: 3, endBar: 6 }), 600);
    expect(state.stretch).toEqual({ startTick: 128, endTick: 384 });
    expect(state.view(600, "Bars 3–6")).toMatchObject({ lastBar: 16, isReset: true, hasPlayRange: true, capSeconds: 600, playRangeLabel: "Bars 3–6" });
  });

  it("keeps an edit until the play range changes, and Use play range copies it again", () => {
    const state = new ExportStretchState();
    state.sync(program, loop({ startBar: 3, endBar: 6 }), 600);
    state.set({ startTick: 168, endTick: 600 }, 600);
    state.sync(program, loop({ startBar: 3, endBar: 6 }), 600);
    expect(state.stretch).toEqual({ startTick: 168, endTick: 600 });
    expect(state.view(600, "Bars 3–6")).toMatchObject({ isReset: false, playRangeLabel: null });
    state.reset(600);
    expect(state.stretch).toEqual({ startTick: 128, endTick: 384 });
  });

  it("cuts an edit to the ruler and the cap; a smaller cap trims the end and says so", () => {
    const state = new ExportStretchState();
    state.sync(program, loop(null), 600);
    state.set({ startTick: 64, endTick: 5_000 }, 600);
    expect(state.stretch).toEqual({ startTick: 64, endTick: 1024 });
    // The Story's 1:00 holds 30 s: nothing to trim; a 10 s cap brings the end to bar 6.
    expect(state.trim(60)).toBe(false);
    expect(state.trim(10)).toBe(true);
    expect(state.stretch).toEqual({ startTick: 64, endTick: 384 });
    expect(state.isAtCap(10)).toBe(true);
    expect(state.secondsAt(64)).toBe(2);
  });

  it("a copy nobody edited follows the cap of the format chosen now; an edit does not grow back", () => {
    const state = new ExportStretchState();
    state.sync(program, loop(null), 10);
    expect(state.stretch).toEqual({ startTick: 0, endTick: 320 });
    state.sync(program, loop(null), 600);
    expect(state.stretch).toEqual({ startTick: 0, endTick: 1024 });
    state.set({ startTick: 0, endTick: 960 }, 600);
    expect(state.trim(10)).toBe(true);
    state.sync(program, loop(null), 600);
    expect(state.stretch).toEqual({ startTick: 0, endTick: 320 });
  });

  it("says the play range's words only while the stretch is that range, uncut", () => {
    const state = new ExportStretchState();
    // No play range: the whole loop has no "Bars 9–28" to say.
    state.sync(program, loop(null), 600);
    expect(state.view(600, null)?.playRangeLabel).toBeNull();
    // Bars 3–6 is 8 s: under the Story's minute, the words show.
    state.sync(program, loop({ startBar: 3, endBar: 6 }), 60);
    expect(state.view(60, "Bars 3–6")?.playRangeLabel).toBe("Bars 3–6");
    // A 4 s cap cuts the copy to bars 3–4: the words would lie, so they go.
    state.trim(4);
    expect(state.view(4, "Bars 3–6")?.playRangeLabel).toBeNull();
    // Use play range brings the copy back; then a handle moves it.
    state.reset(600);
    expect(state.view(600, "Bars 3–6")?.playRangeLabel).toBe("Bars 3–6");
    state.set({ startTick: 136, endTick: 384 }, 600);
    expect(state.view(600, "Bars 3–6")?.playRangeLabel).toBeNull();
  });

  it("has nothing without a program", () => {
    const state = new ExportStretchState();
    state.sync(null, loop(null), 600);
    expect(state.stretch).toBeNull();
    expect(state.view(600, null)).toBeNull();
  });
});
