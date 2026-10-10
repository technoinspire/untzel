// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The held clock and the receipts over the real transport: every frame a command produces
// comes from the receipt's frame, and reaffirming the state changes nothing that sounds.
import { GeneralParameter, type Program } from "@untzel/core";
import { LOOKAHEAD_SECONDS, PreviewTransport, Transport } from "@untzel/transport";
import { fakeCompiler, fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { unpackBatch, type MainToWorkerMessage, type WorkerToMainMessage, type WorkerToWorkletMessage, type WorkletToWorkerMessage } from "../protocol";
import { TransportHost, type WorkletPort } from "./transport-host";

const SR = 48_000;
const LOOKAHEAD = Math.round(LOOKAHEAD_SECONDS * SR);
/** Four different bars: a jump in the loop changes what is scheduled, not only the bar number. */
const KICK_BARS = ["x...x...x...x...", "x.x.x...x...x...", "x...x.x.x...x...", "x...x...x.x.x.x."];
const LOOP = fakeProgram([fakeTrack("kick", { bars: KICK_BARS }), fakeTrack("hat", { bars: ["..x...x...x...x."] })]);
/** LOOP with a quieter kick: a parameters change, applied at once. */
const QUIETER = fakeProgram(
  [fakeTrack("kick", { bars: KICK_BARS, constants: { [GeneralParameter.gain]: 0.5 } }), fakeTrack("hat", { bars: ["..x...x...x...x."] })],
  { sourceHash: 2 },
);

class RecordingPort<Message> {
  readonly sent: Message[] = [];
  onmessage: ((event: { readonly data: WorkletToWorkerMessage }) => void) | null = null;
  postMessage(message: Message): void {
    this.sent.push(message);
  }
}

/** `now` is either a fixed clock moved by hand, or one that advances 1 ms on every call. */
function setup(now: () => number) {
  const main = new RecordingPort<WorkerToMainMessage>();
  const worklet = new RecordingPort<WorkerToWorkletMessage>();
  const host = new TransportHost(
    main,
    (clock, sink) => new Transport({ clock, sink, compile: fakeCompiler }),
    (clock, sink) => new PreviewTransport({ clock, sink, compile: fakeCompiler }),
    now,
  );
  host.receive({ type: "init", protocol: 2, port: worklet as never, sampleRate: SR, instruments: ["hat", "kick"] });
  const report = (frame: number) => (worklet as WorkletPort).onmessage?.({ data: frame });
  const receipts = () => main.sent.flatMap((message) => (message.type === "receipt" ? [message] : []));
  return { host, main, worklet, report, receipts };
}

function advancingClock(): () => number {
  let ms = 0;
  return () => (ms += 1);
}

describe("TransportHost over the real transport, with now() advancing 1 ms per call", () => {
  it("starts a play from the receipt frame: activation, tempo and after", () => {
    const { host, worklet, report, receipts } = setup(advancingClock());
    report(1024);
    host.receive({ type: "receipts", isOn: true });
    host.receive({ type: "load", program: LOOP });
    host.receive({ type: "play", mode: "loop" });
    const play = receipts().at(-1);
    if (play?.frame == null) throw new Error("no play receipt");
    const startFrame = Math.ceil((play.frame + LOOKAHEAD) / 128) * 128;
    expect(play).toMatchObject({ command: "play", horizon: null, after: startFrame });
    const program = worklet.sent.find((message) => message.type === "program");
    const tempo = worklet.sent.find((message) => message.type === "tempo");
    expect(program?.type === "program" && program.atFrame).toBe(startFrame);
    expect(tempo?.type === "tempo" && tempo.atFrame).toBe(startFrame);
  });
  it("puts the immediate points of a load and the stop on the receipt frame", () => {
    const { host, worklet, report, receipts } = setup(advancingClock());
    report(1024);
    host.receive({ type: "load", program: LOOP });
    host.receive({ type: "play", mode: "loop" });
    report(48_000);
    host.tick();
    host.receive({ type: "receipts", isOn: true });
    host.receive({ type: "load", program: QUIETER });
    const load = receipts().at(-1);
    if (load?.frame == null) throw new Error("no load receipt");
    const batch = worklet.sent.at(-1);
    if (batch?.type !== "batch") throw new Error("no immediate points");
    const points = unpackBatch(batch.data).points;
    expect(points.length).toBeGreaterThan(0);
    const frame = load.frame;
    expect(points.every((point) => point.frame === frame + 128)).toBe(true);
    expect(load.horizon).toBe(load.after);
    host.receive({ type: "stop" });
    const stop = receipts().at(-1);
    const stopped = worklet.sent.at(-1);
    expect(stop).toMatchObject({ command: "stop", after: null });
    expect(stop?.horizon).not.toBeNull();
    expect(stopped).toEqual({ type: "stop", atFrame: stop?.frame });
  });
});

describe("TransportHost reaffirmation", () => {
  /** The state a watch reaffirms: background, load and each mode's play range, locate false. */
  function reaffirmation(program: Program, range: { startBar: number; endBar: number }): MainToWorkerMessage[] {
    return [
      { type: "background", isHidden: false },
      { type: "load", program },
      { type: "setPlayRange", change: { mode: "loop", range: { ...range, cycle: true }, locate: false } },
      { type: "setPlayRange", change: { mode: "song", range: null, locate: false } },
    ];
  }
  function playing(locate: boolean) {
    let ms = 0;
    const run = setup(() => ms);
    run.report(0);
    run.host.receive({ type: "load", program: LOOP });
    run.host.receive({ type: "play", mode: "loop" });
    for (let tick = 0; tick < 20; tick += 1) {
      ms += 25;
      run.report(Math.round((ms * SR) / 1000));
      run.host.tick();
    }
    // "Play from here" asks for a jump; the reaffirmation must not cancel it.
    run.host.receive({ type: "setPlayRange", change: { mode: "loop", range: { startBar: 0, endBar: 8, cycle: true }, locate } });
    return { ...run, advance: (byMs: number) => (ms += byMs) };
  }
  function nextBatches(run: ReturnType<typeof playing>): WorkerToWorkletMessage[] {
    const from = run.worklet.sent.length;
    for (let tick = 0; tick < 120; tick += 1) {
      const ms = run.advance(25);
      run.report(Math.round((ms * SR) / 1000));
      run.host.tick();
    }
    return run.worklet.sent.slice(from).map((message) => (message.type === "batch" ? { ...message, data: new Float64Array(message.data) } : message));
  }
  for (const locate of [false, true]) {
    it(`does not change what is scheduled next${locate ? ", also after Play from here" : ""}`, () => {
      const plain = playing(locate);
      const reaffirmed = playing(locate);
      reaffirmed.host.receive({ type: "receipts", isOn: true });
      for (const message of reaffirmation(LOOP, { startBar: 0, endBar: 8 })) reaffirmed.host.receive(message);
      expect(nextBatches(reaffirmed)).toEqual(nextBatches(plain));
      expect(reaffirmed.receipts().map(({ command }) => command)).toEqual(["receipts", "background", "load", "setPlayRange", "setPlayRange"]);
    });
  }
  it("would move the music if a reaffirmed range asked for a jump (the comparison sees it)", () => {
    const plain = playing(false);
    const jumped = playing(false);
    jumped.host.receive({ type: "setPlayRange", change: { mode: "loop", range: { startBar: 0, endBar: 8, cycle: true }, locate: true } });
    const batches = nextBatches(plain);
    expect(batches.some((message) => message.type === "batch" && unpackBatch(message.data).events.length > 0)).toBe(true);
    expect(nextBatches(jumped)).not.toEqual(batches);
  });
});
