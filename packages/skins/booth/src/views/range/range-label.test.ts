// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { PlayRangeView, TransportView } from "@untzel/presentation/view-model";
import { viewFixture } from "../../testing/view-fixture";
import { transportLines } from "./range-label";

const PARTS = [
  { name: "intro", startBar: 1, endBar: 8 },
  { name: "build", startBar: 9, endBar: 12 },
  { name: "drop", startBar: 13, endBar: 28 },
  { name: "break", startBar: 29, endBar: 36 },
  { name: "build", startBar: 37, endBar: 40 },
  { name: "drop", startBar: 41, endBar: 56 },
];
const loopTransport: TransportView = { ...viewFixture().transport, mode: "loop", section: null, bar: 12, totalBars: null, loopBars: 8, loopBar: 4, loopBarsSounding: 8 };
const songTransport: TransportView = { ...viewFixture().transport, mode: "song", section: "drop", bar: 17, totalBars: 56 };
type LabelRange = Pick<PlayRangeView, "sounding" | "parts" | "songNames">;
const none: LabelRange = { sounding: null, parts: PARTS, songNames: null };
const range = (startBar: number, endBar: number, cycle = true) => ({ startBar, endBar, cycle });

describe("transport lines", () => {
  it("loop without and with a range", () => {
    expect(transportLines({ ...loopTransport, loopBar: 2 }, none)).toMatchObject({ full: "Loop · bar 2 of 8", short: "Loop · bar 2 of 8" });
    expect(transportLines(loopTransport, { ...none, sounding: range(3, 6) })).toMatchObject({ full: "Loop · bars 3–6 of 8 · bar 4", short: "bars 3–6 of 8 · bar 4" });
    expect(transportLines({ ...loopTransport, loopBar: null, isPlaying: false }, none).full).toBe("Loop · 8 bars");
  });

  it("song without a range, on part boundaries with unique and repeated names", () => {
    expect(transportLines({ ...songTransport, bar: 21 }, none)).toMatchObject({ full: "Song · drop · bar 21 of 56", short: "drop · bar 21 of 56" });
    const unique = { sounding: range(9, 28), parts: PARTS, songNames: { first: "build", last: "drop", repeated: false, single: false } };
    expect(transportLines(songTransport, unique)).toMatchObject({ full: "Song · build → drop · bar 17 of 56", short: "build → drop · bar 17" });
    const repeated = { ...unique, songNames: { ...unique.songNames, repeated: true } };
    expect(transportLines(songTransport, repeated)).toMatchObject({ full: "Song · build → drop · bars 9–28 · bar 17 of 56", short: "bars 9–28 · bar 17" });
  });

  it("song off part boundaries, a single part, and Cycle off", () => {
    expect(transportLines(songTransport, { sounding: range(10, 28), parts: PARTS, songNames: null })).toMatchObject({ full: "Song · bars 10–28 · bar 17 of 56", short: "bars 10–28 · bar 17" });
    const single = { sounding: range(13, 28), parts: PARTS, songNames: { first: "drop", last: "drop", repeated: true, single: true } };
    expect(transportLines(songTransport, single)).toMatchObject({ full: "Song · drop · bars 13–28 · bar 17 of 56", short: "bars 13–28 · bar 17" });
    const off = { sounding: range(9, 28, false), parts: PARTS, songNames: null };
    expect(transportLines({ ...songTransport, bar: 45 }, off)).toMatchObject({ full: "Song · from build, bar 9 · bar 45 of 56", short: "from bar 9 · bar 45" });
    const offBoundary = { sounding: range(10, 28, false), parts: PARTS, songNames: null };
    expect(transportLines({ ...songTransport, bar: 45 }, offBoundary)).toMatchObject({ full: "Song · from bar 10 · bar 45 of 56", short: "from bar 10 · bar 45" });
  });

  it("a narrow desktop column keeps fewer words beside CPU", () => {
    expect(transportLines({ ...loopTransport, loopBar: 2, loopBars: 16, loopBarsSounding: 16 }, none).narrow).toBe("bar 2 of 16");
    expect(transportLines({ ...songTransport, section: "intro", bar: 1 }, none).narrow).toBe("intro · bar 1");
  });
  it("three-digit bars drop the word bars last", () => {
    const stress = { sounding: range(109, 128), parts: [], songNames: { first: "groove2", last: "drop2", repeated: true, single: false } };
    expect(transportLines({ ...songTransport, bar: 117, totalBars: 248 }, stress).short).toBe("109–128 · bar 117");
  });
});
