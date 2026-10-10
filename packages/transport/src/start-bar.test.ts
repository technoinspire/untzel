// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { buildArrangement, locate, rational, type Program, type SignalValue } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { parameterTableAt } from "./scheduling/signal-sampler";
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
import type { PlaybackMode } from "./types";

const SR = 48_000;
const BARS_COMPARED = 6;

const saw: SignalValue = {
  kind: "signal",
  signal: { shape: "saw", periodBars: rational(3n, 1n) },
  low: 0,
  high: 1,
  from: 0,
  to: 1,
  curve: "linear",
};

/**
 * Patterns of 3 and 5 bars, a 3-bar signal, two sections at 120 and 132 BPM, 25 bars that
 * loop; `loopBars` writes `loop <bars>`, which restarts every pattern on each pass.
 */
function program(loopBars: number | null = null): Program {
  return fakeProgram(
    [
      fakeTrack("kick", { bars: ["x... x... x... x...", "x... x... x.x. x...", "X... x... x... xxxx"] }),
      fakeTrack("hat", {
        bars: ["..x. ..x. ..x. ..x.", ".xx.", "x.x.x.x.", "....", "X..."],
        signals: { 16: saw },
      }),
    ],
    {
      sections: [
        fakeSection("intro", ["kick", "hat"], { tempo: 120 }),
        fakeSection("drop", ["kick", "hat"], { tempo: 132, gain: 0.5 }),
      ],
      song: {
        parts: [
          { section: "intro", bars: 4 },
          { section: "drop", bars: 16 },
          { section: "intro", bars: 5 },
        ],
        loop: true,
      },
      loopBars,
    },
  );
}

interface Run {
  readonly sink: FakeEventSink;
  /** Frame of each bar boundary reported in the batch positions. */
  readonly barFrames: ReadonlyMap<number, number>;
}

function run(mode: PlaybackMode, untilBar: number, startBar?: number, loopBars: number | null = null): Run {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(program(loopBars));
  clock.set(3_001);
  const result =
    startBar === undefined ? transport.play(mode) : transport.play(mode, { startBar });
  expect(result).toEqual({ ok: true });
  const barFrames = new Map<number, number>();
  for (let guard = 0; guard < 100_000; guard += 1) {
    driveClock(transport, clock, (clock.nowFrame() ?? 0) + SR);
    for (const batch of sink.batches) barFrames.set(batch.position.bar, batch.position.frame);
    if (barFrames.has(untilBar)) break;
  }
  return { sink, barFrames };
}

function frameOf(runResult: Run, bar: number): number {
  const frame = runResult.barFrames.get(bar);
  if (frame === undefined) throw new Error(`bar ${bar} was not reached`);
  return frame;
}

const CASES = [
  { mode: "loop", loopBars: null },
  { mode: "song", loopBars: null },
  // A written loop of 3: bar 7 is bar 1 of its pass, as in a play from bar 0.
  { mode: "loop", loopBars: 3 },
] as const;

describe("play(mode, { startBar })", () => {
  for (const { mode, loopBars } of CASES) {
    for (const startBar of [0, 1, 7, 21]) {
      const label = loopBars === null ? mode : `${mode} ${loopBars}`;
      it(`${label} from bar ${startBar} schedules exactly what a play from bar 0 does`, () => {
        const end = startBar + BARS_COMPARED;
        const full = run(mode, end + 1, undefined, loopBars);
        const partial = run(mode, end + 1, startBar, loopBars);
        const fullFrom = frameOf(full, startBar);
        const fullTo = frameOf(full, end);
        const startFrame = partial.sink.activations[0]?.atFrame ?? Number.NaN;
        const shift = fullFrom - startFrame;
        expect(frameOf(partial, startBar)).toBe(startFrame);
        expect(frameOf(partial, end)).toBe(fullTo - shift);

        const window = <T extends { readonly frame: number }>(items: readonly T[], from: number, to: number) =>
          items.filter((item) => item.frame >= from && item.frame < to);
        const fullEvents = window(full.sink.events(), fullFrom, fullTo);
        const partialEvents = window(partial.sink.events(), startFrame, fullTo - shift);
        expect(fullEvents.length).toBeGreaterThan(0);
        expect(partialEvents).toEqual(
          fullEvents.map((event) => ({ ...event, frame: event.frame - shift, generation: 1 })),
        );

        const points = (sink: FakeEventSink) => sink.batches.flatMap((batch) => batch.parameters);
        // Gain points at the start bar itself are replaced by the activation (processedBoundary).
        const fullPoints = window(points(full.sink), fullFrom, fullTo).filter(
          (point) => !(point.frame === fullFrom && point.parameter === 0),
        );
        const partialPoints = window(points(partial.sink), startFrame, fullTo - shift);
        expect(partialPoints.some((point) => point.frame === startFrame && point.parameter === 0)).toBe(false);
        expect(partialPoints).toEqual(
          fullPoints.map((point) => ({ ...point, frame: point.frame - shift, generation: 1 })),
        );

        const fullTempos = full.sink.tempoChanges.filter((change) => change.atFrame > fullFrom && change.atFrame < fullTo);
        const partialTempos = partial.sink.tempoChanges.filter(
          (change) => change.atFrame > startFrame && change.atFrame < fullTo - shift,
        );
        expect(partialTempos).toEqual(fullTempos.map((change) => ({ ...change, atFrame: change.atFrame - shift })));
        const tempoAtStart = [...full.sink.tempoChanges].reverse().find((change) => change.atFrame <= fullFrom);
        expect(partial.sink.tempoChanges[0]).toEqual({ bpm: tempoAtStart?.bpm, atFrame: startFrame });

        const activation = partial.sink.activations[0];
        const arrangement = buildArrangement(program());
        const location = mode === "song" && arrangement !== null ? locate(arrangement, startBar) : null;
        const loopStart = loopBars === null ? 0 : startBar - (startBar % loopBars);
        const phaseStart = location === null ? loopStart : startBar - location.barInPart;
        const gain = location === null ? 1 : location.part.section.gain;
        program().tracks.forEach((track, index) => {
          expect(activation?.tracks[index]?.parameters).toEqual(
            parameterTableAt(track, rational(BigInt(startBar - phaseStart), 1n), program().sourceHash, gain),
          );
        });
      });
    }
  }

  it("rejects a start outside the song or not a whole bar", () => {
    const clock = new FakeClock(SR);
    const transport = new Transport({ clock, sink: new FakeEventSink(), compile: fakeCompiler });
    transport.setProgram(fakeProgram([fakeTrack("kick")], {
      sections: [fakeSection("a", ["kick"])],
      song: { parts: [{ section: "a", bars: 4 }], loop: false },
    }));
    expect(transport.play("song", { startBar: 4 })).toEqual({ ok: false, code: "INVALID_START" });
    expect(transport.play("song", { startBar: -1 })).toEqual({ ok: false, code: "INVALID_START" });
    expect(transport.play("loop", { startBar: 1.5 })).toEqual({ ok: false, code: "INVALID_START" });
    expect(transport.play("song", { startBar: 3 })).toEqual({ ok: true });
  });
});
