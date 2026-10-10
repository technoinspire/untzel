// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A late tick: the transport resumes on the next sixteenth, not the next bar,
// and from there it schedules exactly what a play without the late tick schedules: the
// same events on the same frames, the same positions and the same tempo changes, in loop
// and song mode, inside a play range, across a part boundary and at a tempo change.
import type { Program } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { FakeClock, FakeEventSink, driveClock, fakeCompiler, fakeProgram, fakeSection, fakeTrack } from "./testing";
import type { PlayRange } from "./play-range/play-range";
import { RESYNC_STEPS_PER_BAR, Transport } from "./scheduling/transport";
import type { PlaybackMode } from "./types";

const SR = 48_000;
const BAR_132 = (240 * SR) / 132;
const STEP_132 = BAR_132 / RESYNC_STEPS_PER_BAR;
const SAFETY = 128;
const SIXTEENTHS = "xxxx xxxx xxxx xxxx";

interface Stall {
  /** Bars after the start, at 132 BPM, where the ticks stop and where the late one comes. */
  readonly from: number;
  readonly to: number;
}

interface Scenario {
  readonly program: Program;
  readonly mode: PlaybackMode;
  readonly range?: PlayRange;
  readonly stall: Stall;
  /** Bars after the start, at 132 BPM, to play through. */
  readonly until: number;
}

interface Run {
  readonly sink: FakeEventSink;
  readonly transport: Transport;
  readonly start: number;
}

function run(scenario: Scenario, isLate: boolean): Run {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(scenario.program);
  if (scenario.range !== undefined) transport.setPlayRange({ mode: scenario.mode, range: scenario.range, locate: false });
  clock.set(0);
  transport.play(scenario.mode);
  const start = sink.activations[0]?.atFrame ?? Number.NaN;
  const at = (bars: number) => start + Math.round(bars * BAR_132);
  driveClock(transport, clock, at(scenario.stall.from));
  if (isLate) {
    clock.set(at(scenario.stall.to));
    transport.tick();
  }
  driveClock(transport, clock, at(scenario.until));
  return { sink, transport, start };
}

/** Plays the scenario twice, with and without the late tick, and returns both and the resume frame. */
function compare(scenario: Scenario) {
  const reference = run(scenario, false);
  const late = run(scenario, true);
  const resumeFrame = late.start + Math.round(scenario.stall.to * BAR_132) + SAFETY;
  const from = (sink: FakeEventSink) => sink.events().filter((event) => event.frame >= resumeFrame);
  return { reference, late, resumeFrame, from };
}

function expectSameFromResume(scenario: Scenario): void {
  const { reference, late, resumeFrame, from } = compare(scenario);
  expect(reference.transport.stats()).toEqual({ skippedBars: 0, resyncs: 0 });
  expect(late.transport.stats().resyncs).toBe(1);
  expect(from(late.sink).length, "something plays after the resume").toBeGreaterThan(0);
  // The grid and the origin stay exact: every event from the resume on, frame for frame.
  expect(from(late.sink)).toEqual(from(reference.sink));
  // Positions (bar, part, loop bar, mode) of every later bar are the reference's.
  const later = (sink: FakeEventSink) => sink.batches.map((batch) => batch.position).filter((position) => position.frame > resumeFrame);
  for (const position of later(reference.sink)) expect(later(late.sink)).toContainEqual(position);
  expect(late.sink.tempoChanges).toEqual(reference.sink.tempoChanges);
  expect(late.sink.ends).toEqual(reference.sink.ends);
}

describe("a late tick resumes on the next sixteenth", () => {
  it("in loop mode: the silence is at most one step, and the rest is what the reference plays", () => {
    const scenario: Scenario = {
      program: fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: [SIXTEENTHS] })]),
      mode: "loop",
      stall: { from: 1.3, to: 3.4 },
      until: 6,
    };
    expectSameFromResume(scenario);
    const { late, resumeFrame } = compare(scenario);
    const first = Math.min(...late.sink.events().filter((event) => event.frame >= resumeFrame).map((event) => event.frame));
    // Bar 3.4 plus 128 frames resumes on the 55th step since play (bar 3, step 7), not on bar 4.
    expect(first - resumeFrame).toBeLessThanOrEqual(STEP_132);
    expect(first).toBe(late.start + Number((55n * 240n * 48_000n) / (132n * 16n)));
    expect(late.transport.stats().skippedBars).toBe(2);
  });

  it("in song mode, across a part boundary: the part's tracks and gain land as in the reference", () => {
    const program = fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: [SIXTEENTHS] })], {
      sections: [fakeSection("intro", ["kick"]), fakeSection("build", ["kick", "hat"], { gain: 0.5 })],
      song: { parts: [{ section: "intro", bars: 2 }, { section: "build", bars: 4 }], loop: false },
    });
    const scenario: Scenario = { program, mode: "song", stall: { from: 1.5, to: 2.6 }, until: 5 };
    expectSameFromResume(scenario);
    const { late, resumeFrame } = compare(scenario);
    // The build's gain point, passed during the stall, lands at the resume.
    const points = late.sink.batches.flatMap((batch) => batch.parameters).filter((point) => point.frame === resumeFrame);
    expect(points.map((point) => point.value)).toEqual([0.5, 0.5]);
    expect(late.sink.batches.at(-1)?.position).toMatchObject({ partIndex: 1, section: "build" });
  });

  it("inside a play range: the range's end, passed during the stall, wraps as in the reference", () => {
    const marker = fakeTrack("marker", {
      bars: Array.from({ length: 8 }, (_, bar) => Array.from({ length: 16 }, (_, step) => (step === bar || step % 4 === 2 ? "x" : ".")).join("")),
    });
    expectSameFromResume({
      program: fakeProgram([marker], { loopBars: 8 }),
      mode: "loop",
      range: { startBar: 3, endBar: 6, cycle: true },
      stall: { from: 3.5, to: 4.45 },
      until: 9,
    });
  });

  it("at a tempo change: the new tempo starts on its bar, so every later frame is the reference's", () => {
    const program = fakeProgram([fakeTrack("hat", { bars: [SIXTEENTHS] })], {
      sections: [fakeSection("a", ["hat"]), fakeSection("b", ["hat"], { tempo: 100 })],
      song: { parts: [{ section: "a", bars: 2 }, { section: "b", bars: 4 }], loop: false },
    });
    expectSameFromResume({ program, mode: "song", stall: { from: 1.2, to: 2.7 }, until: 5 });
  });

  it("past the song's end: the song ends on its bar, as in the reference", () => {
    const program = fakeProgram([fakeTrack("kick")], {
      sections: [fakeSection("a", ["kick"])],
      song: { parts: [{ section: "a", bars: 3 }], loop: false },
    });
    const { reference, late } = compare({ program, mode: "song", stall: { from: 2.5, to: 4.2 }, until: 5 });
    expect(late.sink.ends).toEqual(reference.sink.ends);
    expect(late.sink.ends).toHaveLength(1);
  });
});
