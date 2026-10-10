// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ClockPort, EventSink, PlaybackMode } from "@untzel/session";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import type { Take, TakeEntry } from "../take";
import { takeSpan, type TakeOrigin } from "../take-span";
import type { ReplayTransport } from "./replay-ports";
import { takeTimeline, type TakeTimelineParts } from "./take-timeline";

const SR = 44_100;
const ARM = 44_150;
const START = 50_048;
const PROGRAM = fakeProgram([fakeTrack("kick")]);
const r = (frame: number) => Math.round((frame * 48_000) / SR);
const NULL_SINK: EventSink = { deliver() {}, programChanged() {}, tempoChanged() {}, stopped() {}, ended() {} };

/** Starts where the take says, then schedules as asked; reads the clock it was given. */
class ScriptedTransport implements ReplayTransport {
  readonly scheduled: number[] = [];
  readonly clock: ClockPort;
  #until: number | null = null;
  constructor(clock: ClockPort) {
    this.clock = clock;
  }
  setProgram(): void {}
  play(_mode: PlaybackMode): void {
    this.#until = START;
  }
  setMode(): void {}
  stop(): void {
    this.#until = null;
  }
  setPlayRange(): void {}
  setBackground(): void {}
  beatGrid(): null {
    return null;
  }
  scheduledUntil(): number | null {
    return this.#until;
  }
  scheduleUntil(frame: number): void {
    this.scheduled.push(frame);
    if (this.#until !== null) this.#until = Math.max(this.#until, frame);
  }
}

function take(entries: readonly TakeEntry[]): Take {
  return { format: "untzel-take", version: 1, sampleRate: SR, armFrame: ARM, endFrame: START + 3 * SR, endedBy: "stop", entries, instruments: [], title: null };
}
const ENTRIES: readonly TakeEntry[] = [
  { command: { kind: "sounding", source: { at: 0, remove: 0, insert: "kick" }, solo: null, preview: null }, frame: ARM, horizon: null },
  { command: { kind: "play", mode: "loop", startBar: null }, frame: ARM + 100, horizon: null, startFrame: START },
];

function timeline(origin: TakeOrigin, entries = ENTRIES, maxLookaheadSeconds = 2) {
  const transports: ScriptedTransport[] = [];
  const parts: TakeTimelineParts = {
    materialize: () => PROGRAM,
    createTransport: (clock) => {
      const transport = new ScriptedTransport(clock);
      transports.push(transport);
      return transport;
    },
    createPreview: null,
    origin,
    maxLookaheadSeconds,
  };
  return { timeline: takeTimeline(take(entries), parts), transports };
}

describe("takeTimeline", () => {
  for (const origin of ["firstSound", "arm"] as const) {
    it(`starts on the arm's quantum, with sample 0 at the ${origin} origin and no end with the song`, () => {
      const { timeline: built } = timeline(origin);
      const start = built.start({ sink: NULL_SINK, preview: null, sampleRate: 48_000 });
      expect(start).toEqual({
        firstFrame: Math.floor(r(ARM) / 128) * 128,
        musicStartFrame: r(takeSpan(take(ENTRIES), origin)?.startFrame ?? Number.NaN),
        endsWithSong: false,
      });
      expect(start.musicStartFrame).toBe(origin === "arm" ? r(ARM) : r(START));
    });
  }
  it("advances the replay in take frames, and gives the transport the replay clock", () => {
    const { timeline: built, transports } = timeline("firstSound");
    built.start({ sink: NULL_SINK, preview: null, sampleRate: 48_000 });
    const [transport] = transports;
    expect(transport?.clock.nowFrame()).toBe(ARM);
    expect(transport?.clock.staleness()).toBe(0);
    built.advance(r(START));
    const take = Math.round((r(START) * SR) / 48_000);
    expect(transport?.clock.nowFrame()).toBe(take);
    expect(transport?.scheduled.at(-1)).toBe(take + Math.round(0.12 * SR));
  });
  it("hands maxLookaheadSeconds to the replay's search for the song's end", () => {
    // The live transport was stopped when it got this entry; the scripted one never ends.
    const stopped: TakeEntry = { command: { kind: "mode", mode: "loop" }, frame: START + 1_000, horizon: null };
    const { timeline: built, transports } = timeline("firstSound", [...ENTRIES, stopped], 0.25);
    built.start({ sink: NULL_SINK, preview: null, sampleRate: 48_000 });
    expect(() => built.advance(r(START + 1_000))).toThrow(expect.objectContaining({ code: "DIVERGED" }));
    expect(transports[0]?.scheduled.at(-1)).toBe(START + 1_000 + Math.round(0.25 * SR) + 128);
  });
  it("refuses to advance before it starts", () => {
    expect(() => timeline("arm").timeline.advance(0)).toThrow(Error);
  });
});
