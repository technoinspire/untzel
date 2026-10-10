// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { rational, type Program, type SignalValue } from "@untzel/core";
import { describe, expect, it } from "vitest";
import type { PatternCompiler } from "./compiled-program";
import {
  FakeClock,
  FakeEventSink,
  driveClock,
  fakeCompiler,
  fakeProgram,
  fakeSection,
  fakeTrack,
  hitsSpec,
} from "../testing";
import { Transport } from "./transport";

const SR = 48_000;
const LOOKAHEAD = 5_760; // round(0.120 × 48 000)
const BAR_132 = (240 * SR) / 132; // 87 272.72… frames
const RAMP = 960; // round(0.020 × 48 000)

function setup(program: Program, compile: PatternCompiler = fakeCompiler) {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile });
  transport.setProgram(program);
  return { clock, sink, transport };
}

/** frame(bar) from a start frame at 132 BPM, 48 kHz. */
function barFrame(startFrame: number, bar: number): number {
  return startFrame + Number((BigInt(bar) * 240n * 48_000n) / 132n);
}

/** Bar of a frame; frames are floored, so add one frame before dividing. */
function barOf(startFrame: number, frame: number): number {
  return Math.floor((frame - startFrame + 1) / BAR_132);
}

function startFrameOf(sink: FakeEventSink): number {
  return sink.activations[0]?.atFrame ?? Number.NaN;
}

const kickOnly = () => fakeProgram([fakeTrack("kick")]);

describe("play", () => {
  it("starts on a multiple of 128 at least 120 ms after now", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(10_001);
    transport.play("loop");
    const start = startFrameOf(sink);
    expect(start % 128).toBe(0);
    expect(start).toBeGreaterThanOrEqual(10_001 + LOOKAHEAD);
    expect(start - (10_001 + LOOKAHEAD)).toBeLessThan(128);
    expect(sink.tempoChanges).toEqual([{ bpm: 132, atFrame: start }]);
    expect(sink.activations[0]).toMatchObject({ generation: 1, atFrame: start });
    expect(sink.activations[0]?.tracks[0]).toMatchObject({ name: "kick", instrument: "kick" });
  });

  it("waits for the first clock report before starting", () => {
    const { clock, sink, transport } = setup(kickOnly());
    expect(transport.play("loop")).toEqual({ ok: true });
    transport.tick();
    expect(sink.activations).toHaveLength(0);
    clock.set(2_000);
    transport.tick();
    expect(sink.activations).toHaveLength(1);
  });

  it("chooses the mode from the text when called without argument", () => {
    const withSections = fakeProgram([fakeTrack("kick")], {
      sections: [fakeSection("intro", ["kick"])],
    });
    const a = setup(withSections);
    a.clock.set(0);
    a.transport.play();
    driveClock(a.transport, a.clock, 20_000);
    expect(a.sink.batches.at(-1)?.position.mode).toBe("song");

    const b = setup(kickOnly());
    b.clock.set(0);
    b.transport.play();
    driveClock(b.transport, b.clock, 20_000);
    expect(b.sink.batches.at(-1)?.position.mode).toBe("loop");
  });

  it("refuses without a program, and song without sections", () => {
    const clock = new FakeClock(SR);
    const transport = new Transport({ clock, sink: new FakeEventSink(), compile: fakeCompiler });
    expect(transport.play()).toEqual({ ok: false, code: "NO_PROGRAM" });
    transport.setProgram(kickOnly());
    expect(transport.play("song")).toEqual({ ok: false, code: "SONG_UNAVAILABLE" });
  });

  it("stop reports the current frame, stops scheduling, and play makes a new origin", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    driveClock(transport, clock, 100_000);
    transport.stop();
    expect(sink.stops).toEqual([clock.nowFrame()]);
    const delivered = sink.batches.length;
    driveClock(transport, clock, 200_000);
    expect(sink.batches).toHaveLength(delivered);

    transport.play("loop");
    expect(sink.tempoChanges).toHaveLength(2);
    expect(sink.activations[1]?.generation).toBe(2);
    expect((sink.activations[1]?.atFrame ?? 0) % 128).toBe(0);
  });
});

describe("program swap", () => {
  it("activates a structural change only on the next unscheduled bar boundary", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + Math.round(BAR_132 * 1.5));
    const scheduledUntil = (clock.nowFrame() ?? 0) + LOOKAHEAD;

    transport.setProgram(fakeProgram([fakeTrack("kick", { bars: ["x.x."] })]));
    driveClock(transport, clock, start + 4 * BAR_132);

    const boundary = barFrame(start, 2);
    expect(boundary).toBeGreaterThanOrEqual(scheduledUntil);
    expect(sink.activations[1]).toMatchObject({ generation: 2, atFrame: boundary });
    const events = sink.events();
    const before = events.filter((event) => event.frame < boundary);
    const after = events.filter((event) => event.frame >= boundary);
    expect(before.every((event) => event.generation === 1)).toBe(true);
    expect(after.every((event) => event.generation === 2)).toBe(true);
    // Bar 2 of the new pattern: hits at 0 and 1/2 only.
    const bar2 = after.filter((event) => event.frame < barFrame(start, 3)).map((e) => e.frame);
    expect(bar2).toEqual([boundary, start + Math.floor(2.5 * BAR_132)]);
  });

  it("a newer pending change replaces the older one", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + Math.round(BAR_132 * 0.5));
    transport.setProgram(fakeProgram([fakeTrack("kick", { bars: ["x.x."] })]));
    transport.setProgram(fakeProgram([fakeTrack("kick", { bars: ["xxxx xxxx"] })]));
    driveClock(transport, clock, start + 2 * BAR_132);
    expect(sink.activations).toHaveLength(2);
    const bar1 = sink
      .events()
      .filter((event) => event.frame >= barFrame(start, 1) && event.frame < barFrame(start, 2));
    expect(bar1).toHaveLength(8);
  });

  it("applies a parameter-only change at once, without a new generation", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    driveClock(transport, clock, 50_000);
    const now = clock.nowFrame() ?? 0;
    transport.setProgram(fakeProgram([fakeTrack("kick", { constants: { 0: 0.5, 32: 0.7 } })]));
    const points = sink.batches.at(-1)?.parameters ?? [];
    expect(points).toEqual([
      { frame: now + 128, generation: 1, trackIndex: 0, parameter: 0, value: 0.5, rampFrames: RAMP, isConstant: true },
      { frame: now + 128, generation: 1, trackIndex: 0, parameter: 32, value: 0.7, rampFrames: RAMP, isConstant: true },
    ]);
    driveClock(transport, clock, 400_000);
    expect(sink.activations).toHaveLength(1);
  });

  it("a parameter-only change discards a pending structural change", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    driveClock(transport, clock, 50_000);
    transport.setProgram(fakeProgram([fakeTrack("kick", { bars: ["x.x."] })]));
    transport.setProgram(fakeProgram([fakeTrack("kick", { constants: { 0: 0.9 } })]));
    driveClock(transport, clock, 400_000);
    expect(sink.activations).toHaveLength(1);
    expect(sink.events().every((event) => event.generation === 1)).toBe(true);
    const start = startFrameOf(sink);
    const bar2 = sink
      .events()
      .filter((event) => event.frame >= barFrame(start, 2) && event.frame < barFrame(start, 3));
    expect(bar2).toHaveLength(4);
  });

  it("with seeded draws, a new text plays its draws only from the next boundary", () => {
    // The step that plays depends on the source hash, as a "?" draw would.
    const seeded: PatternCompiler = (_spec, context) =>
      fakeCompiler(hitsSpec([["x...", ".x..", "..x.", "...x"][context.sourceHash % 4] ?? ""]), context);
    const seededProgram = (hash: number, gain: number) =>
      fakeProgram([fakeTrack("hat", { constants: { 0: gain } })], { sourceHash: hash, seedDependent: true });

    const { clock, sink, transport } = setup(seededProgram(0, 1), seeded);
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + Math.round(BAR_132 * 0.1));
    const now = clock.nowFrame() ?? 0;
    transport.setProgram(seededProgram(1, 0.5));
    expect(sink.batches.at(-1)?.parameters).toEqual([
      { frame: now + 128, generation: 1, trackIndex: 0, parameter: 0, value: 0.5, rampFrames: RAMP, isConstant: true },
    ]);
    driveClock(transport, clock, start + 3 * BAR_132);

    const frames = sink.events().map((event) => event.frame);
    // Bar 0 keeps the old draw (step 0); bars 1 and 2 use the new one (step 1).
    expect(frames).toEqual([
      start,
      start + Math.floor(1.25 * BAR_132),
      start + Math.floor(2.25 * BAR_132),
    ]);
    expect(sink.activations).toHaveLength(1);
    expect(sink.events().every((event) => event.generation === 1)).toBe(true);
  });

  it("a tempo change makes a new origin at the boundary", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + Math.round(BAR_132 * 0.5));
    transport.setProgram(fakeProgram([fakeTrack("kick")], { tempo: 120 }));
    driveClock(transport, clock, start + 4 * BAR_132);

    const boundary = barFrame(start, 1);
    expect(sink.tempoChanges.at(-1)).toEqual({ bpm: 120, atFrame: boundary });
    const bar120 = (240 * SR) / 120;
    const afterBoundary = sink.events().filter((event) => event.frame >= boundary);
    afterBoundary.slice(0, 8).forEach((event, n) => {
      expect(event.frame).toBe(boundary + Math.floor((n * bar120) / 4));
    });
  });
});

describe("modes and arrangement", () => {
  const songProgram = (options: { loop?: boolean; muted?: boolean } = {}) =>
    fakeProgram(
      [fakeTrack("kick", { muted: options.muted ?? false }), fakeTrack("hat", { bars: ["xxxx"] })],
      {
        sections: [fakeSection("intro", ["hat"]), fakeSection("drop", ["kick", "hat"], { gain: 0.5 })],
        song: {
          parts: [
            { section: "intro", bars: 2 },
            { section: "drop", bars: 3 },
          ],
          loop: options.loop ?? false,
        },
      },
    );

  it("plays each part for its exact bar count, then ends", () => {
    const { clock, sink, transport } = setup(songProgram());
    clock.set(0);
    transport.play("song");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 8 * BAR_132);

    const kicks = sink.events().filter((event) => event.trackIndex === 0);
    expect(kicks[0]?.frame).toBe(barFrame(start, 2));
    expect(kicks).toHaveLength(3 * 4);
    const end = barFrame(start, 5);
    expect(sink.ends).toEqual([end]);
    expect(sink.events().every((event) => event.frame < end)).toBe(true);
    expect(sink.events().filter((event) => event.trackIndex === 1)).toHaveLength(5 * 4);
  });

  it("emits a gain point per section track at the part start", () => {
    const { clock, sink, transport } = setup(songProgram());
    clock.set(0);
    transport.play("song");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 3 * BAR_132);
    const gainPoints = sink.batches
      .flatMap((batch) => batch.parameters)
      .filter((point) => point.parameter === 0 && point.frame === barFrame(start, 2));
    expect(gainPoints).toEqual([
      { frame: barFrame(start, 2), generation: 1, trackIndex: 0, parameter: 0, value: 0.5, rampFrames: RAMP, isConstant: true },
      { frame: barFrame(start, 2), generation: 1, trackIndex: 1, parameter: 0, value: 0.5, rampFrames: RAMP, isConstant: true },
    ]);
  });

  it("reports the song position", () => {
    const { clock, sink, transport } = setup(songProgram());
    clock.set(0);
    transport.play("song");
    const start = startFrameOf(sink);
    driveClock(transport, clock, barFrame(start, 3) - LOOKAHEAD + 10);
    expect(sink.batches.at(-1)?.position).toEqual({
      frame: barFrame(start, 3),
      bar: 3,
      mode: "song",
      partIndex: 1,
      section: "drop",
      barInPart: 1,
      totalBars: 5,
      patternBar: 3,
      loopBar: null,
      loopBars: null,
      framesPerBar: barFrame(start, 4) - barFrame(start, 3),
    });
  });

  it("loops the song with | loop", () => {
    const { clock, sink, transport } = setup(songProgram({ loop: true }));
    clock.set(0);
    transport.play("song");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 11 * BAR_132);
    expect(sink.ends).toEqual([]);
    const kickBars = new Set(
      sink
        .events()
        .filter((event) => event.trackIndex === 0)
        .map((event) => barOf(start, event.frame)),
    );
    expect([...kickBars]).toEqual([2, 3, 4, 7, 8, 9]);
  });

  it("mute silences a track inside its section", () => {
    const { clock, sink, transport } = setup(songProgram({ muted: true }));
    clock.set(0);
    transport.play("song");
    driveClock(transport, clock, 600_000);
    expect(sink.events().filter((event) => event.trackIndex === 0)).toHaveLength(0);
  });

  it("cycles 8 bars per section when there is no song", () => {
    const program = fakeProgram([fakeTrack("kick"), fakeTrack("hat")], {
      sections: [fakeSection("a", ["kick"]), fakeSection("b", ["hat"])],
    });
    const { clock, sink, transport } = setup(program);
    clock.set(0);
    transport.play();
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 17 * BAR_132);
    const barsOf = (trackIndex: number) =>
      new Set(
        sink
          .events()
          .filter((event) => event.trackIndex === trackIndex && event.frame < barFrame(start, 17))
          .map((event) => barOf(start, event.frame)),
      );
    expect(barsOf(0)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 16]));
    expect(barsOf(1)).toEqual(new Set([8, 9, 10, 11, 12, 13, 14, 15]));
    expect(sink.batches.at(-1)?.position.totalBars).toBeNull();
  });

  it("setMode enters on the next unscheduled 4-bar phrase", () => {
    const { clock, sink, transport } = setup(songProgram({ loop: true }));
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, barFrame(start, 4) - LOOKAHEAD + 10); // bar 4 already scheduled
    transport.setMode("song");
    driveClock(transport, clock, start + 12 * BAR_132);
    const modeAt = (bar: number) =>
      sink.batches.find((batch) => batch.position.bar === bar && batch.position.frame === barFrame(start, bar))
        ?.position.mode;
    expect(modeAt(4)).toBe("loop");
    expect(modeAt(7)).toBe("loop");
    expect(modeAt(8)).toBe("song");
    // Entering song starts at part 0 (intro: no kick) on bar 8.
    const kickBars = sink
      .events()
      .filter((event) => event.trackIndex === 0 && event.frame >= barFrame(start, 8))
      .map((event) => barOf(start, event.frame));
    expect(kickBars[0]).toBe(10);
  });

  it("a section tempo makes a new origin and leaving it goes back", () => {
    const program = fakeProgram([fakeTrack("kick")], {
      sections: [fakeSection("a", ["kick"]), fakeSection("b", ["kick"], { tempo: 120 })],
      song: {
        parts: [
          { section: "a", bars: 1 },
          { section: "b", bars: 1 },
          { section: "a", bars: 1 },
        ],
        loop: false,
      },
    });
    const { clock, sink, transport } = setup(program);
    clock.set(0);
    transport.play("song");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 4 * BAR_132);
    const bar1 = barFrame(start, 1);
    const bar2 = bar1 + (240 * SR) / 120;
    expect(sink.tempoChanges).toEqual([
      { bpm: 132, atFrame: start },
      { bpm: 120, atFrame: bar1 },
      { bpm: 132, atFrame: bar2 },
    ]);
    expect(sink.events().map((event) => event.frame)).toContain(bar2);
  });
});

describe("clock trouble", () => {
  // The resync resumes on the next sixteenth, no longer on the next bar.
  it("pauses while the clock is stale and resyncs on the next step", () => {
    const { clock, sink, transport } = setup(kickOnly());
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + BAR_132);
    const delivered = sink.batches.length;
    clock.set((clock.nowFrame() ?? 0) + 1_000, 300);
    transport.tick();
    expect(sink.batches).toHaveLength(delivered);

    clock.set(start + Math.round(BAR_132 * 3.5));
    transport.tick();
    expect(transport.stats().resyncs).toBe(1);
    // Bars 2 and 3 were entered without their first beat.
    expect(transport.stats().skippedBars).toBe(2);
    driveClock(transport, clock, start + 6 * BAR_132);
    const after = sink.events().filter((event) => event.frame > start + BAR_132 * 1.2);
    // Resumed on bar 3.5's step: the next kick of the grid is beat 3 of bar 3, not bar 4.
    expect(after[0]?.frame).toBe(start + Number((BigInt(3 * 16 + 12) * 240n * 48_000n) / (132n * 16n)));
  });
});

describe("signals", () => {
  it("samples a signal every 1/16 bar, each point ramping to the next", () => {
    const sine: SignalValue = {
      kind: "signal",
      signal: { shape: "saw", periodBars: rational(1n, 1n) },
      low: 0,
      high: 1,
      from: 0,
      to: 1,
      curve: "linear",
    };
    const { clock, sink, transport } = setup(fakeProgram([fakeTrack("bass", { signals: { 32: sine } })]));
    clock.set(0);
    transport.play("loop");
    const start = startFrameOf(sink);
    driveClock(transport, clock, start + 2 * BAR_132);
    const points = sink.batches
      .flatMap((batch) => batch.parameters)
      .filter((point) => point.parameter === 32 && point.frame < barFrame(start, 1));
    expect(points).toHaveLength(16);
    points.forEach((point, n) => {
      expect(point.frame).toBe(start + Math.floor((n * BAR_132) / 16));
      expect(point.value).toBeCloseTo(n / 16, 10);
      expect(point.frame + point.rampFrames).toBe(start + Math.floor(((n + 1) * BAR_132) / 16));
    });
  });
});

describe("a program with zero tracks (the Blank project)", () => {
  it("plays silently: no error, no event, no click, and the position still moves", () => {
    const { clock, sink, transport } = setup(fakeProgram([]));
    clock.set(0);
    expect(transport.play("loop")).toEqual({ ok: true });
    driveClock(transport, clock, BAR_132 * 3);
    expect(sink.activations[0]?.tracks).toEqual([]);
    expect(sink.events()).toEqual([]);
    expect(sink.batches.length).toBeGreaterThan(0);
    expect(sink.batches.at(-1)?.position.bar).toBeGreaterThanOrEqual(2);
    expect(sink.stops).toEqual([]);
  });

  it("starts the first track added while it runs on a later bar", () => {
    const { clock, sink, transport } = setup(fakeProgram([]));
    clock.set(0);
    transport.play("loop");
    driveClock(transport, clock, BAR_132 / 2);
    transport.setProgram(kickOnly());
    driveClock(transport, clock, BAR_132 * 3);
    const first = sink.events()[0];
    const activation = sink.activations.find((entry) => entry.generation === first?.generation);
    expect(activation?.tracks[first?.trackIndex ?? -1]?.name).toBe("kick");
    expect(barOf(startFrameOf(sink), first?.frame ?? 0)).toBeGreaterThanOrEqual(1);
  });
});
