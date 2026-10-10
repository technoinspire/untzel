// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A hidden page schedules further ahead (BACKGROUND_LOOKAHEAD_SECONDS): a worker timer
// throttled to once a second must not let the music run dry.
import { describe, expect, it } from "vitest";
import { FakeClock, FakeEventSink, fakeCompiler, fakeProgram, fakeTrack } from "./testing";
import { BACKGROUND_LOOKAHEAD_SECONDS, LOOKAHEAD_SECONDS, Transport } from "./scheduling/transport";
const SR = 48_000;
function playing() {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(fakeProgram([fakeTrack("hat", { bars: ["xxxxxxxxxxxxxxxx"] })]));
  clock.set(0);
  transport.play("loop");
  transport.tick();
  return { clock, sink, transport };
}
const lastFrame = (sink: FakeEventSink): number => Math.max(...sink.events().map((event) => event.frame));
describe("Transport.setBackground", () => {
  it("schedules about LOOKAHEAD_SECONDS ahead while visible", () => {
    const { sink } = playing();
    expect(lastFrame(sink)).toBeLessThan((2 * LOOKAHEAD_SECONDS + 0.2) * SR);
  });
  it("schedules BACKGROUND_LOOKAHEAD_SECONDS ahead while hidden, so a 1 s timer gap leaves no hole", () => {
    const { clock, sink, transport } = playing();
    transport.setBackground(true);
    transport.tick();
    expect(lastFrame(sink)).toBeGreaterThan((BACKGROUND_LOOKAHEAD_SECONDS - 0.2) * SR);
    // One throttled tick a second for five seconds: every 1/16 is still there.
    for (let second = 1; second <= 5; second += 1) {
      clock.set(second * SR);
      transport.tick();
    }
    expect(transport.stats().resyncs).toBe(0);
    expect(transport.stats().skippedBars).toBe(0);
  });
  it("goes back to the short lookahead once visible again", () => {
    const { clock, sink, transport } = playing();
    transport.setBackground(true);
    transport.tick();
    transport.setBackground(false);
    const scheduled = lastFrame(sink);
    clock.set(Math.round(0.5 * SR));
    transport.tick();
    expect(lastFrame(sink)).toBe(scheduled);
  });
});
