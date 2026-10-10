// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The loop section, the cycle origin in song mode and the modulators of the
// activation.
import { rational, type ModulatorSpec, type Track } from "@untzel/core";
import { describe, expect, it } from "vitest";
import {
  FakeClock,
  FakeEventSink,
  driveClock,
  fakeCompiler,
  fakeProgram,
  fakeSection,
  fakeTrack,
} from "./testing";
import { Transport } from "./scheduling/transport";

const SR = 48_000;

function setup(program: ReturnType<typeof fakeProgram>) {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(program);
  clock.set(1_000);
  return { clock, sink, transport };
}

function namesPlayed(sink: FakeEventSink): Set<string> {
  const tracks = sink.activations[0]?.tracks ?? [];
  return new Set(sink.events().map((event) => tracks[event.trackIndex]?.name ?? "?"));
}

const groove = () =>
  fakeProgram([fakeTrack("kick"), fakeTrack("hat"), fakeTrack("pluck")], {
    tempo: 124,
    sections: [
      fakeSection("intro", ["kick"]),
      fakeSection("groove", ["kick", "hat"], { isLoop: true, gain: 0.5 }),
    ],
    song: { parts: [{ section: "intro", bars: 4 }, { section: "groove", bars: 4 }], loop: false },
  });

describe("loop section", () => {
  it("plays only the tracks of the loop section in loop mode", () => {
    const { clock, sink, transport } = setup(groove());
    transport.play("loop");
    driveClock(transport, clock, SR * 10);
    expect(namesPlayed(sink)).toEqual(new Set(["kick", "hat"]));
  });

  it("applies the loop section gain to its tracks", () => {
    const { sink, transport } = setup(groove());
    transport.play("loop");
    const tracks = sink.activations[0]?.tracks ?? [];
    expect(tracks[0]?.parameters[0]).toBe(0.5);
    expect(tracks[2]?.parameters[0]).toBe(1);
  });

  it("uses the loop section tempo", () => {
    const program = groove();
    const withTempo = {
      ...program,
      sections: [program.sections[0]!, { ...program.sections[1]!, tempo: rational(120n, 1n) }],
    };
    const { sink, transport } = setup(withTempo);
    transport.play("loop");
    expect(sink.tempoChanges[0]?.bpm).toBe(120);
  });

  it("changes nothing in song mode", () => {
    const { clock, sink, transport } = setup(groove());
    transport.play("song");
    driveClock(transport, clock, SR * 9);
    expect(namesPlayed(sink).has("pluck")).toBe(false);
    expect(namesPlayed(sink).has("hat")).toBe(true);
  });

  it("without a loop section plays every track", () => {
    const program = fakeProgram([fakeTrack("kick"), fakeTrack("hat")], {
      sections: [fakeSection("a", ["kick"])],
      song: { parts: [{ section: "a", bars: 4 }], loop: false },
    });
    const { clock, sink, transport } = setup(program);
    transport.play("loop");
    driveClock(transport, clock, SR * 4);
    expect(namesPlayed(sink)).toEqual(new Set(["kick", "hat"]));
  });
});

describe("cycle origin", () => {
  it("counts an 8-bar pattern from the start of each part in song mode", () => {
    // impact hits only in the first bar of its 8-bar cycle; parts start at bars 3 and 11.
    const impact = fakeTrack("impact", {
      bars: ["x...", "....", "....", "....", "....", "....", "....", "...."],
    });
    const program = fakeProgram([fakeTrack("kick"), impact], {
      tempo: 240,
      sections: [fakeSection("intro", ["kick"]), fakeSection("drop", ["kick", "impact"])],
      song: {
        parts: [
          { section: "intro", bars: 3 },
          { section: "drop", bars: 8 },
          { section: "drop", bars: 8 },
        ],
        loop: false,
      },
    });
    const { clock, sink, transport } = setup(program);
    transport.play("song");
    driveClock(transport, clock, SR * 20);
    const start = sink.activations[0]?.atFrame ?? 0;
    const bar = SR; // 240 BPM: one bar per second
    const impacts = sink
      .events()
      .filter((event) => event.trackIndex === 1)
      .map((event) => Math.round((event.frame - start) / bar));
    expect(impacts).toEqual([3, 11]);
  });
});

describe("modulators in the activation", () => {
  const lfo: ModulatorSpec = {
    kind: "lfo",
    index: 0,
    shape: "saw",
    periodBars: rational(1n, 8n),
    from: 0.2,
    to: 1,
    curve: "linear",
  };
  const envelope: ModulatorSpec = {
    kind: "envelope",
    index: 33,
    seconds: 0.3,
    from: 300,
    to: 4000,
    curve: "exponential",
  };
  const track = (): Track => ({
    ...fakeTrack("pad"),
    effects: ["distort", "lowpass"],
    modulators: [lfo, envelope],
  });

  it("carries the effect kinds and the modulators in DSP units", () => {
    const { sink, transport } = setup(fakeProgram([track()], { tempo: 120 }));
    transport.play("loop");
    const activated = sink.activations[0]?.tracks[0];
    expect(activated?.effects).toEqual([2, 0]);
    expect(activated?.modulators[0]).toEqual({
      kind: "lfo",
      index: 0,
      shape: 2,
      curve: 0,
      periodFrames: (240 * SR) / 120 / 8,
      originFrame: sink.activations[0]?.atFrame,
      low: 0.2,
      high: 1,
    });
    expect(activated?.modulators[1]).toEqual({
      kind: "envelope",
      index: 33,
      curve: 1,
      seconds: 0.3,
      low: 300,
      high: 4000,
    });
  });

  it("multiplies a gain LFO by the section gain and resends it at every part", () => {
    const program = fakeProgram([track()], {
      sections: [fakeSection("a", ["pad"], { gain: 0.5 }), fakeSection("b", ["pad"])],
      song: { parts: [{ section: "a", bars: 1 }, { section: "b", bars: 1 }], loop: false },
    });
    const { clock, sink, transport } = setup(program);
    transport.play("song");
    driveClock(transport, clock, SR * 3);
    const gains = sink.activations.map((activation) => activation.tracks[0]?.modulators[0]);
    expect(gains[0]).toMatchObject({ low: 0.1, high: 0.5 });
    expect(gains[1]).toMatchObject({ low: 0.2, high: 1 });
    expect(sink.activations[1]?.generation).toBe(sink.activations[0]?.generation);
  });
});
