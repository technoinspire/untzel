// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { FakeClock, FakeEventSink } from "./index";

describe("transport test doubles", () => {
  it("FakeClock reports null before the first frame, then the set frame", () => {
    const clock = new FakeClock(48_000);
    expect(clock.nowFrame()).toBeNull();
    clock.set(1_024);
    clock.advance(128);
    expect(clock.nowFrame()).toBe(1_152);
  });

  it("FakeEventSink records calls in order", () => {
    const sink = new FakeEventSink();
    sink.tempoChanged({ bpm: 132, atFrame: 5_376 });
    sink.stopped(9_000);
    expect(sink.tempoChanges).toEqual([{ bpm: 132, atFrame: 5_376 }]);
    expect(sink.stops).toEqual([9_000]);
  });
});
