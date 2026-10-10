// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The replay's apply against the worker's TransportHost, call by call, and the replay's
// refusals: a take that does not replay as it was recorded fails instead of sounding
// different.
import type { Program } from "@untzel/core";
import type { MainToWorkerMessage, WorkerToMainMessage } from "@untzel/audio/protocol";
import { TransportHost, type PreviewControl, type TransportControl } from "@untzel/audio/worker";
import type { PreviewSink } from "@untzel/session";
import { PreviewTransport, Transport } from "@untzel/transport";
import { fakeCompiler, fakeProgram, fakeSection, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import type { Take, TakeCommand, TakeEntry } from "../take";
import type { ReplayClock, ReplayPreview, ReplayTransport, TakeReplayParts } from "./replay-ports";
import { TakeReplay, TakeReplayError } from "./take-replay";

const SR = 48_000;
const PROGRAM = fakeProgram([fakeTrack("kick")]);
const LOOP_ONLY = fakeProgram([fakeTrack("kick")], { sourceHash: 2 });
const WITH_SONG = fakeProgram([fakeTrack("kick")], { sections: [fakeSection("a", ["kick"])], song: { parts: [{ section: "a", bars: 2 }], loop: false } });

type Command = Exclude<MainToWorkerMessage, { readonly type: "init" }>;
/** One message of each type the worker handles, and the take entry that replays it (null: none). */
const MESSAGES = {
  load: [{ type: "load", program: PROGRAM }, { kind: "sounding", source: { at: 0, remove: 0, insert: "kick" }, solo: null, preview: null }],
  play: [{ type: "play", mode: "song", startBar: 2 }, { kind: "play", mode: "song", startBar: 2 }],
  setMode: [{ type: "setMode", mode: "loop" }, { kind: "mode", mode: "loop" }],
  stop: [{ type: "stop" }, { kind: "stop" }],
  background: [{ type: "background", isHidden: true }, { kind: "background", isHidden: true }],
  setPlayRange: [
    { type: "setPlayRange", change: { mode: "loop", range: { startBar: 1, endBar: 2, cycle: true }, locate: true } },
    { kind: "range", change: { mode: "loop", range: { startBar: 1, endBar: 2, cycle: true }, locate: true } },
  ],
  preview: [{ type: "preview", program: PROGRAM }, { kind: "audition", program: PROGRAM }],
  previewNote: [{ type: "previewNote", program: PROGRAM, midis: [60, 64], seconds: 0.5 }, { kind: "auditionNote", program: PROGRAM, midis: [60, 64], seconds: 0.5 }],
  previewStop: [{ type: "previewStop" }, { kind: "auditionStop" }],
  receipts: [{ type: "receipts", isOn: true }, null],
} satisfies { readonly [Type in Command["type"]]: readonly [Extract<Command, { readonly type: Type }>, TakeCommand | null] };

/** What the schedule reads and moves is the replay's own business; the calls that change state are compared. */
const SCHEDULING = new Set(["scheduledUntil", "scheduleUntil", "tick", "stats"]);

function spies(calls: unknown[][]) {
  const spy = <Target extends object>(name: string, answers: Partial<Record<string, unknown>>): Target =>
    new Proxy({} as Target, {
      get: (_target, member: string) => (...args: unknown[]) => {
        if (!SCHEDULING.has(member)) calls.push([`${name}.${member}`, ...args]);
        return answers[member];
      },
    });
  return {
    transport: spy<TransportControl & ReplayTransport>("transport", { scheduledUntil: null, beatGrid: null, stats: { skippedBars: 0, resyncs: 0 } }),
    preview: spy<PreviewControl & ReplayPreview>("preview", { start: true, note: true }),
  };
}

/** A transport whose song never ends: playing (a number) or stopped (null) from the start, it schedules as far as asked. */
class EndlessTransport implements ReplayTransport {
  readonly scheduled: number[] = [];
  #until: number | null;
  constructor(until: number | null) {
    this.#until = until;
  }
  setProgram(): void {}
  play(): void {}
  setMode(): void {}
  stop(): void {}
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

function takeOf(entries: readonly TakeEntry[], sampleRate = SR): Take {
  return { format: "untzel-take", version: 1, sampleRate, armFrame: 0, endFrame: 10 * sampleRate, endedBy: "stop", entries, instruments: [], title: null };
}

function replayParts(overrides: Partial<TakeReplayParts> = {}): TakeReplayParts {
  const clock: ReplayClock = { sampleRate: SR, frame: 0 };
  return { transport: spies([]).transport, preview: null, clock, materialize: () => PROGRAM, maxLookaheadSeconds: 2, ...overrides };
}

describe("TakeReplay apply", () => {
  for (const [type, [message, command]] of Object.entries(MESSAGES)) {
    it(`calls the transport and the preview as TransportHost does for ${type}`, () => {
      const live: unknown[][] = [];
      const host = new TransportHost({ postMessage: (_message: WorkerToMainMessage) => undefined }, () => spies(live).transport, () => spies(live).preview, () => 0);
      host.receive({ type: "init", protocol: 2, port: { postMessage: () => undefined, onmessage: null } as never, sampleRate: SR, instruments: [] });
      host.receive(message);
      if (command === null) {
        expect(live).toEqual([]);
        return;
      }
      const replayed: unknown[][] = [];
      const { transport, preview } = spies(replayed);
      const replay = new TakeReplay(takeOf([{ command, frame: 1_000, horizon: null }]), replayParts({ transport, preview }));
      replay.advanceTo(1_000);
      expect(live.length).toBeGreaterThan(0);
      expect(replayed).toEqual(live);
    });
  }
});

describe("TakeReplay refusals", () => {
  it("is DIVERGED when the text materializes into a program whose play does not start where it did live", () => {
    const clock = { sampleRate: SR, frame: 0, nowFrame: () => clock.frame, staleness: () => 0 };
    const transport = new Transport({ clock, sink: { deliver() {}, programChanged() {}, tempoChanged() {}, stopped() {}, ended() {} }, compile: fakeCompiler });
    const live = new Transport({ clock, sink: { deliver() {}, programChanged() {}, tempoChanged() {}, stopped() {}, ended() {} }, compile: fakeCompiler });
    live.setProgram(WITH_SONG);
    clock.frame = 1_000;
    live.play("song");
    const sounding: TakeCommand = { kind: "sounding", source: { at: 0, remove: 0, insert: "song" }, solo: null, preview: null };
    const entries: TakeEntry[] = [
      { command: sounding, frame: 0, horizon: null },
      { command: { kind: "play", mode: "song", startBar: null }, frame: 1_000, horizon: null, startFrame: live.scheduledUntil() ?? 0 },
    ];
    expect(() => new TakeReplay(takeOf(entries), replayParts({ transport, clock, materialize: () => WITH_SONG })).advanceTo(1_000)).not.toThrow();
    const other = new Transport({ clock, sink: { deliver() {}, programChanged() {}, tempoChanged() {}, stopped() {}, ended() {} }, compile: fakeCompiler });
    clock.frame = 0;
    const replay = new TakeReplay(takeOf(entries), replayParts({ transport: other, clock, materialize: () => LOOP_ONLY }));
    expect(() => replay.advanceTo(1_000)).toThrow(expect.objectContaining({ code: "DIVERGED" }));
  });
  it("is DIVERGED when the replay's song does not end by entry.frame + maxLookahead + 128", () => {
    const transport = new EndlessTransport(0);
    const replay = new TakeReplay(takeOf([{ command: { kind: "stop" }, frame: 4_000, horizon: null }]), replayParts({ transport, maxLookaheadSeconds: 0.5 }));
    expect(() => replay.advanceTo(4_000)).toThrow(expect.objectContaining({ code: "DIVERGED" }));
    expect(transport.scheduled.at(-1)).toBe(4_000 + 0.5 * SR + 128);
  });
  it("schedules nothing to find the song's end when the replay is already stopped", () => {
    const transport = new EndlessTransport(null);
    const replay = new TakeReplay(takeOf([{ command: { kind: "stop" }, frame: 4_000, horizon: null }]), replayParts({ transport }));
    replay.advanceTo(4_000);
    expect(transport.scheduled).toEqual([4_000 + 0.12 * SR]);
  });
  it("is AUDITION_UNSUPPORTED for an audition without a preview", () => {
    for (const command of [MESSAGES.preview[1], MESSAGES.previewNote[1], MESSAGES.previewStop[1]]) {
      const replay = new TakeReplay(takeOf([{ command, frame: 1_000, horizon: null }]), replayParts());
      expect(() => replay.advanceTo(1_000)).toThrow(expect.objectContaining({ code: "AUDITION_UNSUPPORTED" }));
    }
  });
  it("is BAD_DIFF for a diff outside the text, and lets the composition's UNPLAYABLE_TEXT through", () => {
    const bad: TakeCommand = { kind: "sounding", source: { at: 3, remove: 0, insert: "x" }, solo: null, preview: null };
    expect(() => new TakeReplay(takeOf([{ command: bad, frame: 1_000, horizon: null }]), replayParts()).advanceTo(1_000)).toThrow(
      expect.objectContaining({ code: "BAD_DIFF" }),
    );
    const unplayable = (): Program => {
      throw new TakeReplayError("UNPLAYABLE_TEXT");
    };
    const replay = new TakeReplay(takeOf([{ command: MESSAGES.load[1], frame: 1_000, horizon: null }]), replayParts({ materialize: unplayable }));
    expect(() => replay.advanceTo(1_000)).toThrow(expect.objectContaining({ code: "UNPLAYABLE_TEXT" }));
  });
  it("asserts that ahead × sampleRate covers a quantum and the safety frames", () => {
    expect(() => new TakeReplay(takeOf([], 2_000), replayParts())).toThrow(RangeError);
    expect(() => new TakeReplay(takeOf([], 2_134), replayParts())).not.toThrow();
  });
});

describe("TakeReplay audition", () => {
  it("ends the audition on the stop's frame", () => {
    const clock = { sampleRate: SR, frame: 0, nowFrame: () => clock.frame, staleness: () => 0 };
    const ended: number[] = [];
    const sink: PreviewSink = { previewStarted() {}, previewScheduled() {}, previewEnded: (atFrame) => void ended.push(atFrame) };
    const preview = new PreviewTransport({ clock, sink, compile: fakeCompiler });
    const transport = new Transport({ clock, sink: { deliver() {}, programChanged() {}, tempoChanged() {}, stopped() {}, ended() {} }, compile: fakeCompiler });
    const entries: TakeEntry[] = [
      { command: { kind: "audition", program: PROGRAM }, frame: 1_000, horizon: null },
      { command: { kind: "stop" }, frame: 30_000, horizon: null },
    ];
    const replay = new TakeReplay(takeOf(entries), replayParts({ transport, preview, clock }));
    for (let frame = 0; frame < 40_000; frame += 128) replay.advanceTo(frame);
    expect(ended).toEqual([30_000]);
  });
});
