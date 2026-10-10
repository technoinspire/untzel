// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { AnalyzeResult } from "@untzel/language";
import { fakeProgram, fakeSection, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { PlayRanges } from "./play-range-use-cases";
import { Session } from "./session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "../testing";

const LOOP8 = fakeProgram([fakeTrack("kick")], { loopBars: 8 });
const LOOP4 = fakeProgram([fakeTrack("kick")], { loopBars: 4, sourceHash: 2 });
/** intro 8, build 4, drop 16. */
const SONG = fakeProgram([fakeTrack("kick")], {
  loopBars: 8,
  sourceHash: 3,
  sections: ["intro", "build", "drop"].map((name) => fakeSection(name, ["kick"])),
  song: { parts: [{ section: "intro", bars: 8 }, { section: "build", bars: 4 }, { section: "drop", bars: 16 }], loop: false },
});

function setup(table: Record<string, Program>) {
  const sound = new FakeSoundPort();
  const analyze = (source: string): AnalyzeResult => {
    const program = table[source];
    return program === undefined ? { ok: false, diagnostics: [] } : { ok: true, program, warnings: [] };
  };
  const session = new Session({ sound, load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze });
  const ranges = new PlayRanges(session, sound);
  const rangeCalls = () => sound.calls.flatMap((call) => (call.kind === "setPlayRange" ? [call.change] : []));
  return { session, sound, ranges, rangeCalls };
}

describe("PlayRanges", () => {
  it("refuses before a program, and an invalid range", () => {
    const { session, ranges } = setup({ loop: LOOP8 });
    expect(ranges.set({ kind: "bars", startBar: 3, endBar: 6 })).toEqual({ ok: false, code: "NO_PROGRAM" });
    session.applyText("loop");
    expect(ranges.set({ kind: "bars", startBar: 6, endBar: 3 })).toEqual({ ok: false, code: "INVALID_RANGE" });
    expect(ranges.set({ kind: "bars", startBar: 9, endBar: 9 })).toEqual({ ok: false, code: "INVALID_RANGE" });
  });

  it("sets and clears the loop range, sends it to the transport, and never touches the text", () => {
    const { session, ranges, rangeCalls } = setup({ loop: LOOP8 });
    session.applyText("loop");
    expect(ranges.set({ kind: "bars", startBar: 3, endBar: 6 })).toEqual({ ok: true });
    expect(ranges.view()).toMatchObject({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, lastBar: 8 });
    expect(rangeCalls().at(-1)).toEqual({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, locate: false });
    ranges.clear();
    expect(ranges.view().range).toBeNull();
    expect(rangeCalls().at(-1)).toEqual({ mode: "loop", range: null, locate: false });
    expect(session.state().source).toBe("loop");
  });

  it("an end past the loop is cut to it", () => {
    const { session, ranges } = setup({ loop: LOOP8 });
    session.applyText("loop");
    ranges.set({ kind: "bars", startBar: 3, endBar: 12 });
    expect(ranges.view().range).toEqual({ startBar: 3, endBar: 8, cycle: true });
  });

  it("a shorter loop cuts the range, sends the cut and gives one notice", () => {
    const { session, ranges, rangeCalls } = setup({ loop: LOOP8, short: LOOP4 });
    session.applyText("loop");
    ranges.set({ kind: "bars", startBar: 3, endBar: 6 });
    session.applyText("short");
    expect(ranges.view().range).toEqual({ startBar: 3, endBar: 4, cycle: true });
    expect(ranges.view().notice).toMatchObject({ id: 1, mode: "loop", lastBar: 4 });
    expect(rangeCalls().at(-1)).toEqual({ mode: "loop", range: { startBar: 3, endBar: 4, cycle: true }, locate: false });
  });

  it("one range per mode, written to the mode asked for", () => {
    const { session, ranges } = setup({ song: SONG });
    session.applyText("song");
    session.setMode("loop");
    ranges.set({ kind: "bars", startBar: 2, endBar: 3 });
    session.setMode("song");
    ranges.set({ kind: "part", partIndex: 1 });
    expect(ranges.view()).toMatchObject({ mode: "song", range: { startBar: 9, endBar: 12, cycle: true }, lastBar: 28 });
    expect(ranges.view().loop).toEqual({ startBar: 2, endBar: 3, cycle: true });
    expect(ranges.set({ kind: "extendToPart", partIndex: 2 })).toEqual({ ok: true });
    expect(ranges.view().range).toEqual({ startBar: 9, endBar: 28, cycle: true });
    ranges.set({ kind: "cycle", cycle: false });
    expect(ranges.view().range?.cycle).toBe(false);
    expect(ranges.set({ kind: "part", partIndex: 7 })).toEqual({ ok: false, code: "UNKNOWN_PART" });
  });

  it("Play from here moves only the start, locates, and plays when stopped", () => {
    const { session, sound, ranges, rangeCalls } = setup({ song: SONG });
    session.applyText("song");
    session.setMode("song");
    ranges.set({ kind: "bars", startBar: 9, endBar: 28 });
    expect(ranges.playFrom(13)).toEqual({ ok: true });
    expect(rangeCalls().at(-1)).toEqual({ mode: "song", range: { startBar: 13, endBar: 28, cycle: true }, locate: true });
    expect(sound.calls.at(-1)).toEqual({ kind: "play", mode: "song" });
    expect(session.state().playing).toBe(true);
  });

  it("the part editor's Play from here starts the song range at the part, even from loop mode", () => {
    const { session, ranges, rangeCalls } = setup({ song: SONG });
    session.applyText("song");
    session.setMode("loop");
    expect(ranges.playFromPart(2)).toEqual({ ok: true });
    expect(rangeCalls().at(-1)).toEqual({ mode: "song", range: { startBar: 13, endBar: 28, cycle: false }, locate: true });
    expect(session.state()).toMatchObject({ playing: true, mode: "song" });
  });

  it("a part's Play repeats that part alone, and again on it clears the range", () => {
    const { session, ranges, rangeCalls } = setup({ song: SONG });
    session.applyText("song");
    expect(ranges.playPart(2)).toEqual({ ok: true });
    expect(rangeCalls().at(-1)).toEqual({ mode: "song", range: { startBar: 13, endBar: 28, cycle: true }, locate: true });
    expect(session.state()).toMatchObject({ playing: true, mode: "song" });
    expect(ranges.playPart(2)).toEqual({ ok: true });
    expect(ranges.view().range).toBeNull();
    expect(ranges.playPart(5)).toEqual({ ok: false, code: "UNKNOWN_PART" });
  });

  it("restores ranges from a link: invalid ones are dropped, too long ones cut", () => {
    const { session, ranges } = setup({ song: SONG });
    session.applyText("song");
    ranges.restore({ loop: { startBar: 0, endBar: 3, cycle: true }, song: { startBar: 9, endBar: 99, cycle: false } });
    expect(ranges.playbackRanges()).toEqual({ loop: null, song: { startBar: 9, endBar: 28, cycle: false } });
  });
  it("a received range replaces only its mode's, cut to the music that arrived, and sent without stopping", () => {
    const { session, sound, ranges, rangeCalls } = setup({ song: SONG });
    session.applyText("song");
    session.play("song");
    session.setMode("loop");
    ranges.set({ kind: "bars", startBar: 2, endBar: 3 });
    ranges.receive({ mode: "song", range: { startBar: 9, endBar: 99, cycle: false } });
    expect(ranges.playbackRanges()).toEqual({ loop: { startBar: 2, endBar: 3, cycle: true }, song: { startBar: 9, endBar: 28, cycle: false } });
    expect(rangeCalls().at(-1)).toMatchObject({ mode: "song", range: { startBar: 9, endBar: 28, cycle: false }, locate: false });
    expect(ranges.view().notice).toMatchObject({ mode: "song", lastBar: 28 });
    expect(sound.calls.some((call) => call.kind === "stop")).toBe(false);
  });

  it("nothing received, nothing changes: links, files and projects made before the range travelled", () => {
    const { session, ranges, rangeCalls } = setup({ loop: LOOP8 });
    session.applyText("loop");
    ranges.set({ kind: "bars", startBar: 3, endBar: 6 });
    const sent = rangeCalls().length;
    ranges.receive(null);
    expect(ranges.view().range).toEqual({ startBar: 3, endBar: 6, cycle: true });
    expect(rangeCalls()).toHaveLength(sent);
  });

  it("a received range that cannot be one is dropped", () => {
    const { session, ranges } = setup({ loop: LOOP8 });
    session.applyText("loop");
    ranges.receive({ mode: "loop", range: { startBar: 6, endBar: 3, cycle: true } });
    expect(ranges.view().range).toBeNull();
  });

  it("carries the range the view shows beside a mode, and none without one", () => {
    const { session, ranges } = setup({ song: SONG });
    session.applyText("song");
    session.setMode("song");
    ranges.set({ kind: "part", partIndex: 1 });
    expect(ranges.rangeOf("song")).toEqual({ startBar: 9, endBar: 12, cycle: true });
    expect(ranges.rangeOf("loop")).toBeNull();
    expect(ranges.rangeOf(null)).toBeNull();
  });
});
