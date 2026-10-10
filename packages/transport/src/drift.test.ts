// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { mulberry32 } from "@untzel/core";
import { describe, expect, it } from "vitest";
import {
  FakeClock,
  FakeEventSink,
  driveClock,
  fakeCompiler,
  fakeProgram,
  fakeTrack,
} from "./testing";
import { Transport } from "./scheduling/transport";

// The loop plays 10 minutes without drift.
// Tick gaps are 25 ms plus a 0..95 ms delay drawn by
// mulberry32(1), the worst case the 120 ms lookahead must absorb.

const TEN_MINUTES = 600;

function jitter(): () => number {
  const next = mulberry32(1);
  return () => 25 + next() * 95;
}

describe.each([48_000, 44_100])("10 minutes at 132 BPM, %i Hz", (sampleRate) => {
  it("plays every kick on the exact frame, without duplicates or skips", () => {
    const clock = new FakeClock(sampleRate);
    const sink = new FakeEventSink();
    const transport = new Transport({ clock, sink, compile: fakeCompiler });
    transport.setProgram(
      fakeProgram([
        fakeTrack("kick", { bars: ["x... x... x... x..."] }),
        fakeTrack("hat", { bars: ["..x. ..x. ..x. ..xx"] }),
      ]),
    );
    clock.set(3_000);
    expect(transport.play("loop")).toEqual({ ok: true });
    const startFrame = sink.activations[0]?.atFrame ?? Number.NaN;
    const end = startFrame + TEN_MINUTES * sampleRate;

    driveClock(transport, clock, end, jitter());

    const kicks = sink
      .events()
      .filter((event) => event.trackIndex === 0 && event.frame < end)
      .map((event) => event.frame);
    const sr = BigInt(sampleRate);
    expect(kicks).toEqual(
      Array.from({ length: 1_320 }, (_, n) => startFrame + Number((BigInt(n) * 60n * sr) / 132n)),
    );
    const last = kicks.at(-1) ?? Number.NaN;
    expect(Math.abs(last - (startFrame + (1_319 * 60 * sampleRate) / 132))).toBeLessThan(1);

    const keys = sink.events().map((event) => `${event.trackIndex}:${event.frame}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(transport.stats()).toEqual({ skippedBars: 0, resyncs: 0 });
  });
});

describe("10 000 bars", () => {
  it("never duplicates nor loses an event across windows", () => {
    const sampleRate = 48_000;
    const clock = new FakeClock(sampleRate);
    const sink = new FakeEventSink();
    const transport = new Transport({ clock, sink, compile: fakeCompiler });
    // 200 BPM keeps the run short; 7 steps per bar makes boundaries fall mid-window.
    transport.setProgram(fakeProgram([fakeTrack("hat", { bars: ["xxxxxxx"] })], { tempo: 200 }));
    clock.set(0);
    transport.play("loop");
    const startFrame = sink.activations[0]?.atFrame ?? Number.NaN;
    const framesPerBar = (240 * sampleRate) / 200;
    const bars = 10_000;

    // Gaps near the 120 ms limit keep the run short; the jittered case is covered above.
    const gaps = mulberry32(2);
    driveClock(transport, clock, startFrame + bars * framesPerBar, () => 100 + gaps() * 19);

    const frames = sink
      .events()
      .map((event) => event.frame)
      .filter((frame) => frame < startFrame + bars * framesPerBar);
    const expected = Array.from({ length: bars * 7 }, (_, n) =>
      startFrame + Math.floor((n * framesPerBar) / 7),
    );
    expect(frames).toEqual(expected);
    expect(transport.stats()).toEqual({ skippedBars: 0, resyncs: 0 });
  }, 60_000);
});
