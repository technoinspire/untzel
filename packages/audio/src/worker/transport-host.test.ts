// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program } from "@untzel/core";
import type { BeatGrid, ClockPort, EventSink, PlaybackMode, PlayRangeChange, PreviewSink } from "@untzel/session";
import { describe, expect, it } from "vitest";
import type { WorkerToMainMessage, WorkerToWorkletMessage, WorkletToWorkerMessage } from "../protocol";
import { TransportHost, type PreviewControl, type TransportControl, type WorkletPort } from "./transport-host";
import { WorkletClock } from "./worklet-clock";

class RecordingPort<Message> {
  readonly sent: { message: Message; transfer: ArrayBuffer[] }[] = [];
  onmessage: ((event: { readonly data: WorkletToWorkerMessage }) => void) | null = null;
  postMessage(message: Message, transfer: ArrayBuffer[]): void {
    this.sent.push({ message, transfer });
  }
}

class StubTransport implements TransportControl {
  readonly calls: string[] = [];
  /** What scheduledUntil() answers; play() moves it to 6144, stop() back to null. */
  until: number | null = null;
  constructor(
    readonly clock: ClockPort,
    readonly sink: EventSink,
  ) {}
  setProgram(next: Program): void {
    this.calls.push(`load ${next.sourceHash}`);
  }
  play(mode?: PlaybackMode): void {
    this.calls.push(`play ${mode ?? ""}`);
    this.until = 6144;
  }
  setMode(mode: PlaybackMode): void {
    this.calls.push(`setMode ${mode}`);
  }
  stop(): void {
    this.calls.push("stop");
    this.until = null;
  }
  setPlayRange(change: PlayRangeChange): void {
    this.calls.push(`setPlayRange ${change.mode} ${change.range?.startBar ?? "-"}-${change.range?.endBar ?? "-"}`);
  }
  setBackground(isHidden: boolean): void {
    this.calls.push(`background ${isHidden}`);
  }
  beatGrid(): BeatGrid | null {
    return null;
  }
  scheduledUntil(): number | null {
    return this.until;
  }
  tick(): void {
    this.sink.deliver({
      events: [
        {
          frame: 6144,
          durationFrames: 100,
          generation: 1,
          trackIndex: 0,
          value: { kind: "hit", accent: false },
          velocity: 0.8,
          source: { from: 0, to: 4 },
        },
      ],
      parameters: [],
      position: {
        frame: 6144,
        bar: 0,
        mode: "loop",
        partIndex: null,
        section: null,
        barInPart: null,
        totalBars: null,
        patternBar: 0,
        loopBar: null,
        loopBars: null, framesPerBar: 96_000,
      },
    });
    this.sink.programChanged({
      generation: 1,
      atFrame: 6144,
      lightSourceHash: 1,
      stagePlanHash: 1,
      tracks: [{ name: "kick", instrument: "kick", parameters: [1], effects: [], modulators: [], isMuted: false, isAudible: true }],
    });
  }
  stats() {
    return { skippedBars: 2, resyncs: 1 };
  }
}

class StubPreview implements PreviewControl {
  readonly calls: string[] = [];
  /** What start() answers. */
  accepts = true;
  constructor(readonly sink: PreviewSink) {}
  start(program: Program): boolean {
    this.calls.push(`start ${program.sourceHash}`);
    return this.accepts;
  }
  note(program: Program, midis: readonly number[]): boolean {
    this.calls.push(`note ${program.sourceHash} ${midis.join("+")}`);
    return true;
  }
  stop(): void {
    this.calls.push("stop");
    this.sink.previewEnded(0);
  }
  tick(): void {
    this.calls.push("tick");
  }
}
function setup() {
  const main = new RecordingPort<WorkerToMainMessage>();
  const worklet = new RecordingPort<WorkerToWorkletMessage>();
  let transport: StubTransport | null = null;
  let preview: StubPreview | null = null;
  let now = 0;
  const host = new TransportHost(
    main,
    (clock, sink) => (transport = new StubTransport(clock, sink)),
    (_, sink) => (preview = new StubPreview(sink)),
    () => now,
  );
  host.receive({
    type: "init",
    protocol: 2,
    port: worklet as never,
    sampleRate: 48_000,
    instruments: ["bass", "hat", "kick"],
  });
  const fromWorklet = (data: WorkletToWorkerMessage) => (worklet as WorkletPort).onmessage?.({ data });
  return {
    host,
    main,
    worklet,
    transport: () => transport as unknown as StubTransport,
    preview: () => preview as unknown as StubPreview,
    advance: (ms: number) => (now += ms),
    fromWorklet,
  };
}

describe("TransportHost", () => {
  it("forwards main-thread commands to the transport", () => {
    const { host, transport } = setup();
    host.receive({ type: "load", program: { sourceHash: 7 } as Program });
    host.receive({ type: "play", mode: "loop" });
    host.receive({ type: "setMode", mode: "song" });
    host.receive({ type: "setPlayRange", change: { mode: "song", range: { startBar: 9, endBar: 28, cycle: true }, locate: false } });
    host.receive({ type: "stop" });
    expect(transport().calls).toEqual(["load 7", "play loop", "setMode song", "setPlayRange song 9-28", "stop"]);
  });

  it("runs the audition beside the transport and ends it on play, stop and previewStop", () => {
    const { host, main, worklet, preview } = setup();
    host.receive({ type: "preview", program: { sourceHash: 9 } as Program });
    host.receive({ type: "previewNote", program: { sourceHash: 9 } as Program, midis: [60, 64], seconds: 0.4 });
    host.tick();
    host.receive({ type: "previewStop" });
    host.receive({ type: "play", mode: "loop" });
    host.receive({ type: "stop" });
    expect(preview().calls).toEqual(["start 9", "note 9 60+64", "tick", "stop", "stop", "stop"]);
    expect(main.sent.filter(({ message }) => message.type === "previewEnded")).toHaveLength(3);
    expect(worklet.sent.filter(({ message }) => message.type === "previewStop")).toHaveLength(3);
  });
  it("answers previewEnded when an audition cannot start", () => {
    const { host, main, preview } = setup();
    preview().accepts = false;
    host.receive({ type: "preview", program: { sourceHash: 9 } as Program });
    expect(main.sent.map(({ message }) => message.type)).toEqual(["previewEnded"]);
  });
  it("feeds the worklet frame reports to the clock", () => {
    const { transport, fromWorklet, advance } = setup();
    expect(transport().clock.nowFrame()).toBeNull();
    fromWorklet(1024);
    advance(10);
    expect(transport().clock.nowFrame()).toBe(1024 + 480);
  });

  it("posts the same batch packed and transferred to the worklet and as objects to main", () => {
    const { host, main, worklet } = setup();
    host.tick();
    const [batch, program] = worklet.sent;
    expect(batch?.message.type).toBe("batch");
    expect(batch?.transfer).toHaveLength(1);
    expect(program?.message).toEqual({
      type: "program",
      generation: 1,
      atFrame: 6144,
      tracks: [{ name: "kick", instrumentId: 2, parameters: [1], effects: [], modulators: [] }],
    });
    expect(main.sent[0]?.message.type).toBe("batch");
  });

  it("tells main which track each generation's indexes name, for the light layers", () => {
    const { host, main } = setup();
    host.tick();
    expect(main.sent[1]?.message).toEqual({
      type: "program",
      activation: {
        generation: 1,
        atFrame: 6144,
        lightSourceHash: 1,
        stagePlanHash: 1,
        tracks: [{ name: "kick", instrument: "kick", parameters: [1], effects: [], modulators: [], isMuted: false, isAudible: true }],
      },
    });
  });

  it("asks the worklet for stats and adds the transport and worker counters", () => {
    const { host, main, worklet, fromWorklet } = setup();
    host.receive({ type: "bogus" } as never);
    host.requestStats();
    expect(worklet.sent.at(-1)?.message).toEqual({ type: "statsRequest" });
    fromWorklet({
      type: "stats",
      stats: {
        frame: 0,
        lateDrops: 0,
        queueDrops: 0,
        nanResets: 0,
        unknownMessages: 1,
        unknownTargets: 0,
        instances: [],
      },
    });
    expect(main.sent.at(-1)?.message).toEqual({
      type: "stats",
      stats: {
        frame: 0,
        lateDrops: 0,
        queueDrops: 0,
        nanResets: 0,
        unknownMessages: 2,
        unknownTargets: 0,
        instances: [],
        skippedBars: 2,
        resyncs: 1,
      },
    });
  });
});

describe("TransportHost receipts", () => {
  const receipts = (main: RecordingPort<WorkerToMainMessage>) =>
    main.sent.flatMap(({ message }) => (message.type === "receipt" ? [message] : []));
  it("posts none while receipts are off", () => {
    const { host, main, fromWorklet } = setup();
    fromWorklet(1024);
    host.receive({ type: "load", program: { sourceHash: 7 } as Program });
    host.receive({ type: "play", mode: "loop" });
    host.receive({ type: "stop" });
    expect(receipts(main)).toEqual([]);
  });
  it("answers each message once, in order, with the held frame and the horizon before and after", () => {
    const { host, main, fromWorklet, advance } = setup();
    fromWorklet(1024);
    host.receive({ type: "receipts", isOn: true });
    advance(1);
    host.receive({ type: "load", program: { sourceHash: 7 } as Program });
    host.receive({ type: "play", mode: "loop" });
    host.receive({ type: "background", isHidden: true });
    host.receive({ type: "stop" });
    host.receive({ type: "bogus" } as never);
    expect(receipts(main)).toEqual([
      { type: "receipt", command: "receipts", frame: 1024, horizon: null, after: null },
      { type: "receipt", command: "load", frame: 1024 + 48, horizon: null, after: null },
      { type: "receipt", command: "play", frame: 1024 + 48, horizon: null, after: 6144 },
      { type: "receipt", command: "background", frame: 1024 + 48, horizon: 6144, after: 6144 },
      { type: "receipt", command: "stop", frame: 1024 + 48, horizon: 6144, after: null },
    ]);
  });
  it("answers the receipts message itself, turning on and turning off, and nothing after", () => {
    const { host, main } = setup();
    host.receive({ type: "receipts", isOn: true });
    host.receive({ type: "setMode", mode: "song" });
    host.receive({ type: "receipts", isOn: false });
    host.receive({ type: "setMode", mode: "loop" });
    expect(receipts(main).map(({ command }) => command)).toEqual(["receipts", "setMode", "receipts"]);
    expect(receipts(main)[0]?.frame).toBeNull();
  });
  it("holds the clock for the transport and the preview during a tick", () => {
    const { host, transport, preview, fromWorklet, advance } = setup();
    fromWorklet(1024);
    const frames: (number | null)[] = [];
    transport().tick = () => {
      frames.push(transport().clock.nowFrame());
      advance(10);
    };
    preview().tick = () => {
      frames.push(transport().clock.nowFrame());
    };
    host.tick();
    expect(frames).toEqual([1024, 1024]);
    expect(transport().clock.nowFrame()).toBe(1024 + 480);
  });
});
describe("WorkletClock", () => {
  it("extrapolates from the last report and caps a stale one", () => {
    let now = 100;
    const clock = new WorkletClock(48_000, () => now);
    expect(clock.staleness()).toBe(Number.POSITIVE_INFINITY);
    clock.report(4096);
    now += 5;
    expect(clock.nowFrame()).toBe(4096 + 240);
    expect(clock.staleness()).toBe(5);
    now += 10_000;
    expect(clock.nowFrame()).toBe(4096 + 8 * 128 * 4);
  });
});
