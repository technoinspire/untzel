// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The explicit schedule horizon: tick() is its clock checks followed by scheduleUntil(now +
// lookahead), so a caller that owns time (a replay) schedules the same batches.
import { describe, expect, it } from "vitest";
import { FakeClock, FakeEventSink, fakeCompiler, fakeProgram, fakeTrack } from "./testing";
import { LOOKAHEAD_SECONDS, Transport } from "./scheduling/transport";

const SR = 48_000;
const LOOKAHEAD = Math.round(LOOKAHEAD_SECONDS * SR);
const PROGRAM = fakeProgram([fakeTrack("kick", { bars: ["x...x...x...x..."] }), fakeTrack("hat", { bars: ["..x...x...x...x."] })]);

function playing() {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(PROGRAM);
  clock.set(0);
  transport.play("loop");
  return { clock, sink, transport };
}

describe("Transport.scheduleUntil", () => {
  it("delivers the same batches as tick() at now + lookahead", () => {
    const ticked = playing();
    const explicit = playing();
    for (let now = 0; now < 4 * SR; now += 1_200) {
      ticked.clock.set(now);
      ticked.transport.tick();
      explicit.clock.set(now);
      explicit.transport.scheduleUntil(now + LOOKAHEAD);
    }
    expect(explicit.sink.batches).toEqual(ticked.sink.batches);
    expect(explicit.sink.activations).toEqual(ticked.sink.activations);
    expect(explicit.transport.scheduledUntil()).toBe(ticked.transport.scheduledUntil());
  });
  it("does nothing at or below what is already scheduled", () => {
    const { sink, transport } = playing();
    transport.scheduleUntil(SR);
    const delivered = sink.batches.length;
    transport.scheduleUntil(SR);
    transport.scheduleUntil(SR / 2);
    expect(sink.batches).toHaveLength(delivered);
    expect(transport.scheduledUntil()).toBe(SR);
  });
  it("does nothing while stopped", () => {
    const { sink, transport } = playing();
    transport.stop();
    transport.scheduleUntil(SR);
    expect(sink.batches).toHaveLength(0);
  });
});

describe("Transport.scheduledUntil", () => {
  it("is null while stopped", () => {
    const { transport } = playing();
    transport.stop();
    expect(transport.scheduledUntil()).toBeNull();
  });
  it("is null with a play pending on a clock that has not reported", () => {
    const clock = new FakeClock(SR);
    const transport = new Transport({ clock, sink: new FakeEventSink(), compile: fakeCompiler });
    transport.setProgram(PROGRAM);
    expect(transport.play("loop")).toEqual({ ok: true });
    expect(transport.scheduledUntil()).toBeNull();
  });
  it("is the start frame once a play began, then the horizon of each tick", () => {
    const { clock, transport } = playing();
    const startFrame = Math.ceil(LOOKAHEAD / 128) * 128;
    expect(transport.scheduledUntil()).toBe(startFrame);
    clock.set(startFrame);
    transport.tick();
    expect(transport.scheduledUntil()).toBe(startFrame + LOOKAHEAD);
  });
});
