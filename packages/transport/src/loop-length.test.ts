// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { INSTRUMENT_PARAMETER_OFFSET, rational, type Program, type SignalValue } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { classifyChange } from "./scheduling/classify-change";
import { FakeClock, FakeEventSink, driveClock, fakeCompiler, fakeProgram, fakeSection, fakeTrack } from "./testing";
import { Transport } from "./scheduling/transport";

// `loop <bars>` in loop mode.

const SR = 48_000;
const BAR_132 = (240 * SR) / 132;
const STEPS = 16;

function setup(program: Program) {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(program);
  clock.set(0);
  return { clock, sink, transport };
}

/** Frame of step `step` (of 16) of `bar`, from the start frame, at 132 BPM. */
function stepFrame(start: number, bar: number, step: number): number {
  return start + Number((BigInt(bar * STEPS + step) * 240n * 48_000n) / (132n * BigInt(STEPS)));
}

/** A pattern of `count` bars whose bar k has one hit, on step k % 16: the step names the bar. */
function marker(count: number) {
  const bars = Array.from({ length: count }, (_, k) =>
    Array.from({ length: STEPS }, (_, step) => (step === k % STEPS ? "x" : ".")).join(""),
  );
  return fakeTrack("marker", { bars });
}

/** The pattern bar heard in each absolute bar, read back from the marker's step. */
function patternBarsHeard(sink: FakeEventSink, start: number, bars: number): number[] {
  const events = sink.events().filter((event) => event.trackIndex === 0);
  return Array.from({ length: bars }, (_, bar) => {
    const inBar = events.filter((event) => event.frame >= stepFrame(start, bar, 0) && event.frame < stepFrame(start, bar + 1, 0));
    if (inBar.length !== 1) return -1;
    const frame = inBar[0]?.frame ?? 0;
    return Array.from({ length: STEPS }, (_, step) => step).find((step) => stepFrame(start, bar, step) === frame) ?? -1;
  });
}

function startOf(sink: FakeEventSink): number {
  return sink.activations[0]?.atFrame ?? Number.NaN;
}

describe("loop <bars> in loop mode", () => {
  it("a 16-bar loop cycles exactly: bar 16 plays pattern bar 0 again", () => {
    const { clock, sink, transport } = setup(fakeProgram([marker(20)], { loopBars: 16 }));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 40, 0));
    const heard = patternBarsHeard(sink, start, 40);
    expect(heard).toEqual(Array.from({ length: 40 }, (_, bar) => bar % 16));
    const positions = sink.batches.map((batch) => batch.position);
    const atBar = (bar: number) => positions.find((position) => position.bar === bar);
    expect(atBar(15)).toMatchObject({ loopBar: 15, loopBars: 16, patternBar: 15 });
    expect(atBar(16)).toMatchObject({ loopBar: 0, loopBars: 16, patternBar: 0 });
    expect(atBar(37)).toMatchObject({ loopBar: 5, loopBars: 16, patternBar: 5 });
  });

  it("without loop, every pattern keeps its own cycle; the length shown is the longest, at most 16", () => {
    const { clock, sink, transport } = setup(fakeProgram([marker(20)]));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 24, 0));
    // Pattern bar 16..19 of the 20-bar pattern are heard; their marker steps are 0..3.
    expect(patternBarsHeard(sink, start, 24)).toEqual(Array.from({ length: 24 }, (_, bar) => (bar % 20) % 16));
    const position = sink.batches.map((batch) => batch.position).find((candidate) => candidate.bar === 17);
    expect(position).toMatchObject({ loopBar: 1, loopBars: 16, patternBar: 17 });
  });

  it("a shorter loop enters on the next bar, with no lost or duplicated events", () => {
    const kick = fakeTrack("kick", { bars: ["x... x... x... x..."] });
    const { clock, sink, transport } = setup(fakeProgram([marker(16), kick], { loopBars: 16 }));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, Math.round(stepFrame(start, 5, 8)));
    transport.setProgram(fakeProgram([marker(16), kick], { loopBars: 4 }));
    driveClock(transport, clock, stepFrame(start, 16, 0));

    // Bar 5 is still the 16-bar loop; bar 6 is past 4 bars, so the loop starts again.
    expect(patternBarsHeard(sink, start, 16)).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1]);
    const swap = stepFrame(start, 6, 0);
    expect(sink.activations[1]?.atFrame).toBe(swap);
    const kicks = sink.events().filter((event) => event.trackIndex === 1 && event.frame < stepFrame(start, 16, 0));
    expect(kicks.map((event) => event.frame)).toEqual(
      Array.from({ length: 16 * 4 }, (_, n) => stepFrame(start, Math.floor(n / 4), (n % 4) * 4)),
    );
    expect(kicks.every((event) => event.generation === (event.frame < swap ? 1 : 2))).toBe(true);
  });

  it("a longer loop keeps counting from where it is", () => {
    const { clock, sink, transport } = setup(fakeProgram([marker(16)], { loopBars: 4 }));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, Math.round(stepFrame(start, 2, 8)));
    transport.setProgram(fakeProgram([marker(16)], { loopBars: 8 }));
    driveClock(transport, clock, stepFrame(start, 12, 0));
    expect(patternBarsHeard(sink, start, 12)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]);
  });

  it("writing a loop while playing keeps the place inside it (bar 7 of 8 stays bar 3 of 4)", () => {
    const { clock, sink, transport } = setup(fakeProgram([marker(16)]));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, Math.round(stepFrame(start, 5, 8)));
    transport.setProgram(fakeProgram([marker(16)], { loopBars: 4 }));
    driveClock(transport, clock, stepFrame(start, 10, 0));
    // From bar 6 the pass started at bar 4: bar 6 reads pattern bar 2.
    expect(patternBarsHeard(sink, start, 10)).toEqual([0, 1, 2, 3, 4, 5, 2, 3, 0, 1]);
  });

  it("restarts signals on every pass of a written loop", () => {
    const saw: SignalValue = {
      kind: "signal",
      signal: { shape: "saw", periodBars: rational(4n, 1n) },
      low: 0,
      high: 1,
      from: 0,
      to: 1,
      curve: "linear",
    };
    const { clock, sink, transport } = setup(fakeProgram([fakeTrack("bass", { signals: { [INSTRUMENT_PARAMETER_OFFSET]: saw } })], { loopBars: 2 }));
    transport.play("loop");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 5, 0));
    const valueAt = (bar: number) =>
      sink.batches.flatMap((batch) => batch.parameters).find((point) => point.parameter === INSTRUMENT_PARAMETER_OFFSET && point.frame === stepFrame(start, bar, 0))?.value;
    expect([valueAt(0), valueAt(1), valueAt(2), valueAt(3), valueAt(4)]).toEqual([0, 0.25, 0, 0.25, 0]);
  });

  it("song mode ignores the loop length and reports no loop position", () => {
    const program = fakeProgram([marker(8)], {
      loopBars: 2,
      sections: [fakeSection("a", ["marker"])],
      song: { parts: [{ section: "a", bars: 8 }], loop: true },
    });
    const { clock, sink, transport } = setup(program);
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, stepFrame(start, 8, 0));
    expect(patternBarsHeard(sink, start, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sink.batches.at(-1)?.position).toMatchObject({ mode: "song", loopBar: null, loopBars: null });
  });

  it("entering loop mode from a song starts a pass of the written loop", () => {
    const program = fakeProgram([marker(8)], {
      loopBars: 2,
      sections: [fakeSection("a", ["marker"])],
      song: { parts: [{ section: "a", bars: 16 }], loop: true },
    });
    const { clock, sink, transport } = setup(program);
    transport.play("song");
    const start = startOf(sink);
    driveClock(transport, clock, Math.round(stepFrame(start, 1, 8)));
    transport.setMode("loop");
    driveClock(transport, clock, stepFrame(start, 8, 0));
    // Mode changes wait for the 4-bar phrase: bars 0..3 are the song, then the 2-bar loop.
    expect(patternBarsHeard(sink, start, 8)).toEqual([0, 1, 2, 3, 0, 1, 0, 1]);
  });

  it("a different loop length is a structural change", () => {
    const a = fakeProgram([marker(4)], { loopBars: 4 });
    expect(classifyChange(a, fakeProgram([marker(4)], { loopBars: 8 }))).toBe("structural");
    expect(classifyChange(a, fakeProgram([marker(4)]))).toBe("structural");
    expect(classifyChange(a, fakeProgram([marker(4)], { loopBars: 4 }))).toBe("parameters");
  });
});
