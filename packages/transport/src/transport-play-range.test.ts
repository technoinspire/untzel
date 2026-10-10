// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range inside the real Transport, on the fake clock.
import type { Program } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { FakeClock, FakeEventSink, driveClock, fakeCompiler, fakeProgram, fakeSection, fakeTrack } from "./testing";
import { LOOKAHEAD_SECONDS, Transport } from "./scheduling/transport";

const SR = 48_000;
const STEPS = 16;
const LOOKAHEAD = Math.round(LOOKAHEAD_SECONDS * SR);

function setup(program: Program) {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(program);
  clock.set(0);
  return { clock, sink, transport };
}

function stepFrame(start: number, bar: number, step: number): number {
  return start + Number((BigInt(bar * STEPS + step) * 240n * 48_000n) / (132n * BigInt(STEPS)));
}

/** Bar k of the pattern hits step k: the step heard names the pattern bar. */
function marker(count: number) {
  const bars = Array.from({ length: count }, (_, k) =>
    Array.from({ length: STEPS }, (_, step) => (step === k % STEPS ? "x" : ".")).join(""),
  );
  return fakeTrack("marker", { bars });
}

/** The ruler bar (1-based) heard in each absolute bar since play, from the marker. */
function loopBarsHeard(sink: FakeEventSink, start: number, bars: number): number[] {
  const events = sink.events().filter((event) => event.trackIndex === 0);
  return Array.from({ length: bars }, (_, bar) => {
    const inBar = events.filter((event) => event.frame >= stepFrame(start, bar, 0) - 1 && event.frame < stepFrame(start, bar + 1, 0) - 1);
    if (inBar.length !== 1) return -1;
    const frame = inBar[0]?.frame ?? 0;
    // A play from a later bar uses a virtual origin: frames may round one off.
    return (Array.from({ length: STEPS }, (_, step) => step).find((step) => Math.abs(stepFrame(start, bar, step) - frame) <= 1) ?? -2) + 1;
  });
}

/** The song bar (1-based) of each absolute bar, from the batch positions. */
function songBarsHeard(sink: FakeEventSink, start: number, bars: number, partStarts: readonly number[]): number[] {
  return Array.from({ length: bars }, (_, bar) => {
    const position = sink.batches.find((batch) => Math.abs(batch.position.frame - stepFrame(start, bar, 0)) <= 1)?.position;
    if (position === undefined || position.partIndex === null || position.barInPart === null) return -1;
    return (partStarts[position.partIndex] ?? 0) + position.barInPart + 1;
  });
}

const startOf = (sink: FakeEventSink) => sink.activations[0]?.atFrame ?? Number.NaN;
const loop8 = () => fakeProgram([marker(8)], { loopBars: 8 });

/** intro 2, build 2, drop 4: 8 bars, song bars 1–2, 3–4, 5–8. */
function song(loop: boolean): Program {
  return fakeProgram([fakeTrack("kick")], {
    sections: [fakeSection("intro", ["kick"]), fakeSection("build", ["kick"]), fakeSection("drop", ["kick"])],
    song: { parts: [{ section: "intro", bars: 2 }, { section: "build", bars: 2 }, { section: "drop", bars: 4 }], loop },
  });
}
const PART_STARTS = [0, 2, 4];

describe("play range in loop mode", () => {
  it("stopped, play starts on the range and cycles 3–6 only", () => {
    const { clock, sink, transport } = setup(loop8());
    transport.setPlayRange({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, locate: false });
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 10, 0));
    expect(loopBarsHeard(sink, start, 10)).toEqual([3, 4, 5, 6, 3, 4, 5, 6, 3, 4]);
  });

  it("a range without `loop` written realigns every pattern on each pass", () => {
    const program = fakeProgram([marker(4)]);
    const { clock, sink, transport } = setup(program);
    transport.setPlayRange({ mode: "loop", range: { startBar: 2, endBar: 3, cycle: true }, locate: false });
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 6, 0));
    expect(loopBarsHeard(sink, start, 6)).toEqual([2, 3, 2, 3, 2, 3]);
  });

  it("a change while playing enters on the next unscheduled bar, and the music never stops", () => {
    const { clock, sink, transport } = setup(loop8());
    transport.play("loop");
    const start = startOf(sink);
    // Bar 2 (0-based) is already inside the 120 ms window: the change lands on bar 3.
    driveClock(transport, clock, stepFrame(start, 2, 0) - LOOKAHEAD + 10);
    transport.setPlayRange({ mode: "loop", range: { startBar: 6, endBar: 7, cycle: true }, locate: false });
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(loopBarsHeard(sink, start, 8)).toEqual([1, 2, 3, 6, 7, 6, 7, 6]);
    expect(sink.stops).toEqual([]);
    expect(sink.ends).toEqual([]);
  });

  it("the bar that comes anyway stays when it is inside the new range (no jump)", () => {
    const { clock, sink, transport } = setup(loop8());
    transport.setPlayRange({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, locate: false });
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 3, 0) - LOOKAHEAD + 10); // bar 6 of the ruler scheduled
    transport.setPlayRange({ mode: "loop", range: { startBar: 3, endBar: 8, cycle: true }, locate: false });
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(loopBarsHeard(sink, start, 8)).toEqual([3, 4, 5, 6, 7, 8, 3, 4]);
  });

  it("clearing keeps the pass: 7, 8, then 1, until stop", () => {
    const { clock, sink, transport } = setup(fakeProgram([marker(8)]));
    transport.setPlayRange({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, locate: false });
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 3, 0) - LOOKAHEAD + 10);
    transport.setPlayRange({ mode: "loop", range: null, locate: false });
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(loopBarsHeard(sink, start, 8)).toEqual([3, 4, 5, 6, 7, 8, 1, 2]);
  });

  it("a loop shortened behind the range is clamped on entry", () => {
    const { clock, sink, transport } = setup(loop8());
    transport.setPlayRange({ mode: "loop", range: { startBar: 3, endBar: 6, cycle: true }, locate: false });
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 1, 0) - LOOKAHEAD + 10);
    transport.setProgram(fakeProgram([marker(8)], { loopBars: 4, sourceHash: 2 }));
    driveClock(transport, clock, stepFrame(start, 6, 0));
    expect(loopBarsHeard(sink, start, 6)).toEqual([3, 4, 3, 4, 3, 4]);
  });
});

describe("play range in song mode", () => {
  it("Cycle on repeats build → drop (bars 3–8)", () => {
    const { clock, sink, transport } = setup(song(false));
    transport.setPlayRange({ mode: "song", range: { startBar: 3, endBar: 8, cycle: true }, locate: false });
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 10, 0));
    expect(songBarsHeard(sink, start, 10, PART_STARTS)).toEqual([3, 4, 5, 6, 7, 8, 3, 4, 5, 6]);
    expect(sink.ends).toEqual([]);
  });

  it("Cycle off plays from the start on into the song and ends with it", () => {
    const { clock, sink, transport } = setup(song(false));
    transport.setPlayRange({ mode: "song", range: { startBar: 3, endBar: 4, cycle: false }, locate: false });
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 9, 0));
    expect(songBarsHeard(sink, start, 6, PART_STARTS)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(sink.ends).toHaveLength(1);
    expect(Math.abs((sink.ends[0] ?? 0) - stepFrame(start, 6, 0))).toBeLessThanOrEqual(1);
  });

  it("Cycle off in a looping song goes on to bar 1, not to the range start", () => {
    const { clock, sink, transport } = setup(song(true));
    transport.setPlayRange({ mode: "song", range: { startBar: 5, endBar: 6, cycle: false }, locate: false });
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 7, 0));
    expect(songBarsHeard(sink, start, 7, PART_STARTS)).toEqual([5, 6, 7, 8, 1, 2, 3]);
  });

  it("a part's Play (locate) jumps to the part on the next bar, even from inside the range", () => {
    const { clock, sink, transport } = setup(song(true));
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 1, 0) - LOOKAHEAD + 10); // song bar 2 scheduled
    transport.setPlayRange({ mode: "song", range: { startBar: 5, endBar: 8, cycle: true }, locate: true });
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(songBarsHeard(sink, start, 8, PART_STARTS)).toEqual([1, 2, 5, 6, 7, 8, 5, 6]);
    expect(sink.stops).toEqual([]);
  });

  it("the song range waits for song mode and enters with it on the phrase", () => {
    const { clock, sink, transport } = setup(song(true));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 1, 0));
    transport.setMode("song");
    transport.setPlayRange({ mode: "song", range: { startBar: 5, endBar: 6, cycle: true }, locate: false });
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(songBarsHeard(sink, start, 8, PART_STARTS).slice(4)).toEqual([5, 6, 5, 6]);
  });
});
