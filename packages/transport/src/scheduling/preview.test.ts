// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { rational } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { PREVIEW_GAIN, PREVIEW_GENERATION, PREVIEW_MAX_BARS, PREVIEW_TRACK, PreviewTransport, type PreviewSink } from "./preview";
import { FakeClock, driveClock, fakeCompiler, fakeProgram, fakeTrack } from "../testing";
import type { ActivatedTrack, ParameterPoint, ScheduledEvent } from "../types";

const SAMPLE_RATE = 48_000;
/** One bar at 120 BPM is 2 s. */
const BAR = 2 * SAMPLE_RATE;

class RecordingPreviewSink implements PreviewSink {
  readonly started: { track: ActivatedTrack; atFrame: number }[] = [];
  readonly events: ScheduledEvent[] = [];
  readonly points: ParameterPoint[] = [];
  readonly ended: number[] = [];
  previewStarted(track: ActivatedTrack, atFrame: number): void {
    this.started.push({ track, atFrame });
  }
  previewScheduled(events: readonly ScheduledEvent[], points: readonly ParameterPoint[]): void {
    this.events.push(...events);
    this.points.push(...points);
  }
  previewEnded(atFrame: number): void {
    this.ended.push(atFrame);
  }
}

function setup() {
  const clock = new FakeClock(SAMPLE_RATE);
  const sink = new RecordingPreviewSink();
  const preview = new PreviewTransport({ clock, sink, compile: fakeCompiler });
  const program = fakeProgram([fakeTrack("p", { instrument: "piano", bars: ["x... x... x... x..."] })], { tempo: 120 });
  return { clock, sink, preview, program };
}

describe("PreviewTransport", () => {
  it("with the music stopped, starts on a render quantum at least 120 ms ahead, on the reserved slot", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(1_000);
    expect(preview.start(program, null)).toBe(true);
    const start = sink.started[0]?.atFrame ?? 0;
    expect(start % 128).toBe(0);
    expect(start).toBeGreaterThanOrEqual(1_000 + 0.12 * SAMPLE_RATE);
    expect(sink.started[0]?.track.parameters[0]).toBeCloseTo(PREVIEW_GAIN);
    driveClock(preview, clock, start + BAR);
    expect(sink.events.length).toBeGreaterThan(0);
    expect(sink.events.every((event) => event.generation === PREVIEW_GENERATION && event.trackIndex === PREVIEW_TRACK)).toBe(true);
    expect(sink.events[0]?.frame).toBe(start);
  });

  it("with the music playing, joins the next beat of the music's grid and tempo", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(100_000);
    preview.start(program, { frame: 48_000, bpm: rational(124n, 1n) });
    const beat = (60 * SAMPLE_RATE) / 124;
    const start = sink.started[0]?.atFrame ?? 0;
    expect(start).toBeGreaterThanOrEqual(100_000 + 0.12 * SAMPLE_RATE);
    expect(Math.abs((start - 48_000) / beat - Math.round((start - 48_000) / beat))).toBeLessThan(1e-3);
  });

  it("loops the pattern and ends by itself after 16 bars", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(0);
    preview.start(program, null);
    const start = sink.started[0]?.atFrame ?? 0;
    driveClock(preview, clock, start + (PREVIEW_MAX_BARS + 2) * BAR);
    expect(sink.events).toHaveLength(4 * PREVIEW_MAX_BARS);
    expect(sink.ended).toEqual([start + PREVIEW_MAX_BARS * BAR]);
    expect(preview.isActive).toBe(false);
  });

  it("stop and a new preview end the one playing", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(0);
    preview.start(program, null);
    preview.start(program, null);
    expect(sink.ended).toHaveLength(1);
    preview.stop();
    expect(sink.ended).toHaveLength(2);
    preview.stop();
    expect(sink.ended).toHaveLength(2);
  });

  it("a touched note plays now, off the beat grid, with the track's own gain, for the asked length", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(10_000);
    expect(preview.note(program, [60], 0.4)).toBe(true);
    const start = sink.started[0]?.atFrame ?? 0;
    expect(start % 128).toBe(0);
    expect(start - 10_000).toBeLessThanOrEqual(0.03 * SAMPLE_RATE + 128);
    expect(sink.started[0]?.track.parameters[0]).toBe(1);
    expect(sink.events).toEqual([expect.objectContaining({ frame: start, durationFrames: 0.4 * SAMPLE_RATE, value: { kind: "note", midi: 60, writtenMidi: 60 }, trackIndex: PREVIEW_TRACK })]);
  });

  it("a chord sounds every pitch, and each note cuts the one before (one voice per track)", () => {
    const { clock, sink, preview, program } = setup();
    clock.set(0);
    preview.note(program, [60, 63, 67], 0.4);
    expect(sink.ended).toEqual([]);
    preview.note(program, [62], 0.4);
    expect(sink.ended).toHaveLength(1);
    expect(sink.events[0]?.value).toEqual({ kind: "chord", midis: [60, 63, 67] });
    expect(preview.note(program, [], 0.4)).toBe(false);
  });

  it("refuses before the first clock report or without a track", () => {
    const { preview, program, clock } = setup();
    expect(preview.start(program, null)).toBe(false);
    clock.set(0);
    expect(preview.start({ ...program, tracks: [] }, null)).toBe(false);
  });
});
