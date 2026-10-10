// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Live against replay. The live side is the worker's TransportHost over the real
// Transport, its clock held per message over a worklet clock that goes back; the
// TakeRecorder records its receipts. The replay runs the take on a fresh Transport and
// must schedule the same music, frame by frame.
import { GeneralParameter, mulberry32, type Program } from "@untzel/core";
import type { MainToWorkerMessage, WorkerToMainMessage } from "@untzel/audio/protocol";
import { TransportHost } from "@untzel/audio/worker";
import type { ActivatedTrack, EventSink, ParameterPoint, PlaybackMode, PlayRange, PreviewSink, ProgramActivation, ScheduledBatch, ScheduledEvent, TempoChange } from "@untzel/session";
import { BACKGROUND_LOOKAHEAD_SECONDS, LOOKAHEAD_SECONDS, PREVIEW_GENERATION, PreviewTransport, Transport } from "@untzel/transport";
import { fakeCompiler, fakeProgram, fakeSection, fakeTrack } from "@untzel/transport/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Take } from "../take";
import { TakeRecorder, type ReceiptOutcome, type SentCommand } from "../take-recorder";
import type { Materialize } from "./replay-ports";
import { TakeReplay } from "./take-replay";
import { takeTimeline } from "./take-timeline";

const INSTRUMENTS = ["kick", "hat", "bass"];
const KICK = ["x...x...x...x...", "x.x.x...x...x...", "x...x.x.x...x...", "x...x...x.x.x.x."];
const HAT = fakeTrack("hat", { bars: ["..x...x...x...x."] });
const SONG = { parts: [{ section: "intro", bars: 1 }, { section: "main", bars: 2 }], loop: false };
const SECTIONS = [fakeSection("intro", ["kick"]), fakeSection("main", ["kick", "hat"])];
const song = (tracks: Parameters<typeof fakeProgram>[0], options: Parameters<typeof fakeProgram>[1] = {}) => fakeProgram(tracks, { sections: SECTIONS, song: SONG, ...options });
/** Texts and what they analyze to: pattern, parameter, structure, tempo and seed changes. */
const PROGRAMS: Readonly<Record<string, Program>> = {
  "kick and hat": song([fakeTrack("kick", { bars: KICK }), HAT]),
  "another kick": song([fakeTrack("kick", { bars: [...KICK].reverse() }), HAT], { sourceHash: 2 }),
  "quieter kick": song([fakeTrack("kick", { bars: KICK, constants: { [GeneralParameter.gain]: 0.5 } }), HAT], { sourceHash: 3 }),
  "with a bass": fakeProgram([fakeTrack("kick", { bars: KICK }), HAT, fakeTrack("bass", { bars: ["x.......x......."] })], {
    sections: [fakeSection("intro", ["kick"]), fakeSection("main", ["kick", "hat", "bass"])],
    song: SONG,
    sourceHash: 4,
  }),
  "faster main": fakeProgram([fakeTrack("kick", { bars: KICK }), HAT], { sections: [SECTIONS[0] ?? fakeSection("intro", []), fakeSection("main", ["kick", "hat"], { tempo: 140 })], song: SONG, sourceHash: 5 }),
  "drawn again": song([fakeTrack("kick", { bars: KICK }), HAT], { sourceHash: 6, seedDependent: true }),
  "song at 120": song([fakeTrack("kick", { bars: KICK }), HAT], { tempo: 120, sourceHash: 7 }),
};
const TEXTS = Object.keys(PROGRAMS).filter((text) => text !== "song at 120");
const MODES: readonly PlaybackMode[] = ["loop", "song"];

const materialize: Materialize = (recipe) => {
  const program = PROGRAMS[recipe.source];
  if (program === undefined) throw new Error(`no program for ${recipe.source}`);
  return program;
};
const load = (text: string): SentCommand => ({ kind: "sounding", recipe: { source: text, solo: null, preview: null }, instruments: INSTRUMENTS });
const play = (mode: PlaybackMode, startBar: number | null = null): SentCommand => ({ kind: "play", mode, startBar });

function messageOf(command: SentCommand): MainToWorkerMessage {
  switch (command.kind) {
    case "arm":
    case "disarm":
      return { type: "receipts", isOn: command.kind === "arm" };
    case "sounding":
      return { type: "load", program: materialize(command.recipe) };
    case "play":
      return command.startBar === null ? { type: "play", mode: command.mode } : { type: "play", mode: command.mode, startBar: command.startBar };
    case "mode":
      return { type: "setMode", mode: command.mode };
    case "stop":
      return { type: "stop" };
    case "range":
      return { type: "setPlayRange", change: command.change };
    case "background":
      return { type: "background", isHidden: command.isHidden };
    case "audition":
      return { type: "preview", program: command.program };
    case "auditionNote":
      return { type: "previewNote", program: command.program, midis: command.midis, seconds: command.seconds };
    case "auditionStop":
      return { type: "previewStop" };
  }
}

/** One thing the transport or the preview delivered, with the frame it sounds at. */
interface Item {
  readonly kind: string;
  readonly frame: number;
  readonly data: Readonly<Record<string, unknown>>;
}
class SinkLog implements EventSink, PreviewSink {
  readonly items: Item[] = [];
  /** Each delivery, with the frame the recipient was at (the replay clock's quantum). */
  onItem: (item: Item) => void = () => undefined;
  #add(kind: string, frame: number, data: object): void {
    const item = { kind, frame, data: data as Item["data"] };
    this.items.push(item);
    this.onItem(item);
  }
  deliver(batch: ScheduledBatch): void {
    for (const event of batch.events) this.#add("event", event.frame, event);
    for (const point of batch.parameters) this.#add("point", point.frame, point);
  }
  programChanged(change: ProgramActivation): void {
    this.#add("activation", change.atFrame, change);
  }
  tempoChanged(change: TempoChange): void {
    this.#add("tempo", change.atFrame, change);
  }
  stopped(atFrame: number): void {
    this.#add("stopped", atFrame, { atFrame });
  }
  ended(atFrame: number): void {
    this.#add("ended", atFrame, { atFrame });
  }
  previewStarted(track: ActivatedTrack, atFrame: number): void {
    this.#add("previewStarted", atFrame, { track, atFrame });
  }
  previewScheduled(events: readonly ScheduledEvent[], points: readonly ParameterPoint[]): void {
    for (const event of events) this.#add("previewEvent", event.frame, event);
    for (const point of points) this.#add("previewPoint", point.frame, point);
  }
  previewEnded(atFrame: number): void {
    this.#add("previewEnded", atFrame, { atFrame });
  }
}

/** The worker, its worklet clock and the page's recorder. */
class LiveRig {
  readonly log = new SinkLog();
  readonly outcomes: ReceiptOutcome[] = [];
  readonly sampleRate: number;
  recorder: TakeRecorder | null = null;
  lastFrame: number | null = null;
  ms = 1_000;
  readonly #worklet = { postMessage: () => undefined, onmessage: null as ((event: { readonly data: number }) => void) | null };
  readonly #host: TransportHost;
  #transport: Transport | null = null;

  /** `advancing`: now() moves 1 ms on every call, as a busy worker does. */
  constructor(sampleRate: number, advancing: boolean) {
    this.sampleRate = sampleRate;
    const main = { postMessage: (message: WorkerToMainMessage) => this.#fromWorker(message) };
    const createTransport = (clock: ConstructorParameters<typeof Transport>[0]["clock"]) =>
      (this.#transport = new Transport({ clock, sink: this.log, compile: fakeCompiler }));
    const createPreview = (clock: ConstructorParameters<typeof PreviewTransport>[0]["clock"]) => new PreviewTransport({ clock, sink: this.log, compile: fakeCompiler });
    this.#host = new TransportHost(main, createTransport, createPreview, () => (advancing ? (this.ms += 1) : this.ms));
    this.#host.receive({ type: "init", protocol: 2, port: this.#worklet as never, sampleRate, instruments: INSTRUMENTS });
  }
  /** The frame the worklet renders at this.ms. */
  get frame(): number {
    return Math.round((this.ms * this.sampleRate) / 1000);
  }
  report(frame = this.frame): void {
    this.#worklet.onmessage?.({ data: frame });
  }
  /** The worker's timer at `ms` (never back), right after a report on time. */
  tickAt(ms: number): void {
    this.ms = Math.max(this.ms, ms);
    this.report();
    this.#host.tick();
  }
  at(frame: number): void {
    this.ms = (frame * 1000) / this.sampleRate;
    this.report(frame);
  }
  record(includesAuditions = false): void {
    this.recorder = new TakeRecorder({ sampleRate: this.sampleRate, capSeconds: Number.POSITIVE_INFINITY, includesAuditions });
  }
  send(command: SentCommand): void {
    this.recorder?.sent(command);
    this.#host.receive(messageOf(command));
  }
  scheduledUntil(): number | null {
    return this.#transport?.scheduledUntil() ?? null;
  }
  resyncs(): number {
    return this.#transport?.stats().resyncs ?? 0;
  }
  /** Disarms and closes the take on the disarm receipt; every receipt must have been accepted. */
  finish(): Take {
    this.send({ kind: "disarm" });
    const take = this.recorder?.finish("stop", this.lastFrame ?? 0, null) ?? null;
    expect(this.outcomes.filter((outcome) => outcome !== "recorded")).toEqual(["disarmed"]);
    expect(this.resyncs()).toBe(0);
    if (take === null) throw new Error("no take");
    return take;
  }
  #fromWorker(message: WorkerToMainMessage): void {
    if (message.type !== "receipt" || this.recorder === null) return;
    this.lastFrame = message.frame;
    this.outcomes.push(this.recorder.received(message));
  }
}

const to48 = (rate: number) => (frame: number) => Math.round((frame * 48_000) / rate);

/** The live item at 48 kHz, field by field, as the export hears it. */
function at48(item: Item, rate: number): Item {
  const r = to48(rate);
  const data = { ...item.data } as Record<string, unknown>;
  for (const field of ["frame", "durationFrames", "rampFrames", "atFrame"]) if (typeof data[field] === "number") data[field] = r(data[field]);
  const tracks = (data.tracks ?? (data.track === undefined ? undefined : [data.track])) as ActivatedTrack[] | undefined;
  const moved = tracks?.map((track) => ({
    ...track,
    modulators: track.modulators.map((modulator) => (modulator.kind === "lfo" ? { ...modulator, periodFrames: r(modulator.periodFrames), originFrame: r(modulator.originFrame) } : modulator)),
  }));
  if (data.tracks !== undefined) data.tracks = moved;
  if (data.track !== undefined) data.track = moved?.[0];
  return { kind: item.kind, frame: r(item.frame), data };
}

/** Sorted by frame, generations counted from the first activation, positions left out. */
function canonical(items: readonly Item[]): string[] {
  const first = items.find((item) => item.kind === "activation")?.data.generation;
  const base = typeof first === "number" ? first : 0;
  return items
    .map((item) => {
      const generation = item.data.generation;
      const data = typeof generation === "number" && generation !== PREVIEW_GENERATION ? { ...item.data, generation: generation - base } : item.data;
      return { frame: item.frame, key: `${item.kind} ${JSON.stringify(data)}` };
    })
    .sort((a, b) => a.frame - b.frame || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ frame, key }) => `${frame} ${key}`);
}

/** The take rendered as the export does: the timeline at 48 kHz, one quantum at a time. */
function replayed(take: Take, withPreview = false): SinkLog {
  const log = new SinkLog();
  const timeline = takeTimeline(take, {
    materialize,
    createTransport: (clock, sink) => new Transport({ clock, sink, compile: fakeCompiler }),
    createPreview: withPreview ? (clock, sink) => new PreviewTransport({ clock, sink, compile: fakeCompiler }) : null,
    origin: "arm",
    maxLookaheadSeconds: BACKGROUND_LOOKAHEAD_SECONDS,
  });
  const start = timeline.start({ sink: log, preview: withPreview ? log : null, sampleRate: 48_000 });
  const last = to48(take.sampleRate)(take.endFrame);
  for (let frame = start.firstFrame; frame <= last; frame += 128) timeline.advance(frame);
  return log;
}

/** Everything live delivered from `mark` on and up to the take's end, against the replay; returns how many events live had. */
function expectSameMusic(rig: LiveRig, mark: number, take: Take): number {
  const below = Math.min(take.endFrame, rig.scheduledUntil() ?? take.endFrame);
  const live = rig.log.items.slice(mark).filter((item) => item.frame < below);
  const last48 = to48(take.sampleRate)(below - 1);
  const replay = replayed(take).items.filter((item) => item.frame <= last48);
  expect(canonical(replay)).toEqual(canonical(live.map((item) => at48(item, take.sampleRate))));
  return live.filter((item) => item.kind === "event").length;
}

/** A performance drawn from a seed: ticks of 25 to 115 ms, late worklet reports, random commands. */
class DrawnPerformance {
  readonly rig: LiveRig;
  readonly #next: () => number;
  /** What the page would reaffirm on Record, as CommandLog keeps it. */
  readonly #state: { text: string; isHidden: boolean; ranges: Record<PlaybackMode, PlayRange | null> } = { text: TEXTS[0] ?? "", isHidden: false, ranges: { loop: null, song: null } };
  #tickMs: number;

  constructor(seed: number, sampleRate: number) {
    this.#next = mulberry32(seed);
    this.rig = new LiveRig(sampleRate, true);
    this.#tickMs = this.rig.ms;
  }

  /** Plays a while, records, plays on, and returns where the take's music starts in the log. */
  run(): { readonly mark: number; readonly take: Take } {
    const { rig } = this;
    rig.report();
    rig.send(load(this.#state.text));
    rig.send(play("loop"));
    this.#ticks(3 + this.#below(10));
    for (let index = this.#below(4); index > 0; index -= 1) this.#send(this.#command());
    this.#ticks(1 + this.#below(4));
    const mark = this.#record();
    for (let index = 8 + this.#below(12); index > 0; index -= 1) {
      this.#ticks(this.#below(12));
      this.#send(this.#command());
    }
    // Long enough, now and then, for a song to reach its end.
    const until = rig.frame + (1.5 + this.#next() * 6) * rig.sampleRate;
    while (rig.frame < until) this.#ticks(1);
    return { mark, take: rig.finish() };
  }

  /** Record: arm, the reaffirmation, and the music started again from a stopped transport. */
  #record(): number {
    const { rig } = this;
    rig.record();
    const wasPlaying = rig.scheduledUntil() !== null;
    this.#send({ kind: "arm" });
    this.#send({ kind: "background", isHidden: this.#state.isHidden });
    this.#send(load(this.#state.text));
    for (const mode of MODES) this.#send({ kind: "range", change: { mode, range: this.#state.ranges[mode], locate: false } });
    if (wasPlaying) this.#send({ kind: "stop" });
    const mark = rig.log.items.length;
    this.#send(play(this.#pick(MODES)));
    return mark;
  }

  #ticks(count: number): void {
    for (let tick = 0; tick < count; tick += 1) this.rig.tickAt((this.#tickMs = Math.max(this.#tickMs + 25 + this.#next() * 90, this.rig.ms)));
  }

  /** Early in the tick's interval, after a report up to 2 048 frames late. */
  #send(command: SentCommand): void {
    const { rig } = this;
    rig.ms = Math.max(rig.ms, this.#tickMs + this.#next() * 20);
    if (this.#next() < 0.7) rig.report(rig.frame - this.#below(2_049));
    rig.send(command);
  }

  #command(): SentCommand {
    const roll = this.#next();
    if (roll < 0.25) return load((this.#state.text = this.#pick(TEXTS)));
    if (roll < 0.35) return { kind: "mode", mode: this.#pick(MODES) };
    if (roll < 0.5) return this.#range();
    if (roll < 0.58) return { kind: "stop" };
    if (roll < 0.8) return play(this.#pick(MODES), this.#next() < 0.6 ? null : this.#below(3));
    return { kind: "background", isHidden: (this.#state.isHidden = this.#next() < 0.5) };
  }

  #range(): SentCommand {
    const mode = this.#pick(MODES);
    const startBar = 1 + this.#below(3);
    const range = this.#next() < 0.3 ? null : { startBar, endBar: startBar + this.#below(4 - startBar), cycle: mode === "loop" || this.#next() < 0.5 };
    this.#state.ranges[mode] = range;
    return { kind: "range", change: { mode, range, locate: this.#next() < 0.3 } };
  }

  #below(count: number): number {
    return Math.floor(this.#next() * count);
  }

  #pick<Value>(list: readonly Value[]): Value {
    return list[this.#below(list.length)] as Value;
  }
}

describe.each([48_000, 44_100])("the replay of a take at %i Hz", (sampleRate) => {
  it("schedules what the live transport scheduled, over 200 drawn performances", () => {
    // A drawn performance may stop at once; most must make music for the comparison to mean something.
    let withMusic = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (seed) => {
        const performance = new DrawnPerformance(seed, sampleRate);
        const { mark, take } = performance.run();
        if (expectSameMusic(performance.rig, mark, take) > 0) withMusic += 1;
      }),
      { numRuns: 200, seed: 20_261_006 },
    );
    expect(withMusic).toBeGreaterThan(150);
    // About 2 s on an idle machine, over 6 s while a Rust build runs beside it: past the 5 s default.
  }, 60_000);
});

describe("the replay's on-time delivery", () => {
  it("never delivers anything for a frame before the quantum being rendered", () => {
    const rig = new LiveRig(48_000, true);
    let tickMs = rig.ms;
    const ticks = (count: number) => {
      for (let tick = 0; tick < count; tick += 1) rig.tickAt((tickMs += 40 + ((tick * 37) % 70)));
    };
    rig.report();
    rig.record(true);
    for (const command of [{ kind: "arm" }, { kind: "background", isHidden: false }, load("kick and hat"), play("loop")] as const) rig.send(command);
    ticks(20);
    rig.send({ kind: "background", isHidden: true });
    ticks(8);
    rig.send(load("quieter kick"));
    const loadFrame = rig.lastFrame ?? 0;
    ticks(8);
    rig.send({ kind: "auditionNote", program: PROGRAMS["kick and hat"] as Program, midis: [60, 64], seconds: 0.3 });
    ticks(8);
    rig.send({ kind: "stop" });
    ticks(4);
    const take = rig.finish();
    const log = new SinkLog();
    const clock = { sampleRate: take.sampleRate, frame: take.armFrame, nowFrame: () => clock.frame, staleness: () => 0 };
    const transport = new Transport({ clock, sink: log, compile: fakeCompiler });
    const preview = new PreviewTransport({ clock, sink: log, compile: fakeCompiler });
    const replay = new TakeReplay(take, { transport, preview, clock, materialize, maxLookaheadSeconds: BACKGROUND_LOOKAHEAD_SECONDS });
    let quantum = 0;
    const late: Item[] = [];
    log.onItem = (item) => void (item.frame < quantum && late.push(item));
    for (quantum = Math.floor(take.armFrame / 128) * 128; quantum <= take.endFrame; quantum += 128) replay.advanceTo(quantum);
    expect(late).toEqual([]);
    const kinds = new Set(log.items.map((item) => item.kind));
    for (const kind of ["event", "point", "activation", "stopped", "previewStarted", "previewEvent", "previewEnded"]) expect(kinds).toContain(kind);
    expect(log.items.some((item) => item.kind === "point" && item.frame === loadFrame + 128)).toBe(true);
  });
});

/** A rig whose clock is moved by hand, frame by frame. */
function exactRig(hidden: boolean, text = "song at 120") {
  const rig = new LiveRig(48_000, false);
  rig.at(48_000);
  rig.record();
  for (const command of [{ kind: "arm" }, { kind: "background", isHidden: hidden }, load(text)] as const) rig.send(command);
  const mark = rig.log.items.length;
  const tickAt = (frame: number) => {
    rig.at(frame);
    rig.tickAt(rig.ms);
  };
  const sendAt = (frame: number, command: SentCommand) => {
    rig.at(frame);
    rig.send(command);
  };
  return { rig, mark, tickAt, sendAt };
}

describe("the song's end before it sounds", () => {
  const BAR = 96_000; // 120 BPM at 48 kHz
  for (const [hidden, detected, command] of [
    [false, 0.1, 0.05],
    [true, 1.5, 0.5],
  ] as const) {
    it(`replays a play that came ${command} s before the end${hidden ? " with the page hidden" : ""}, the end found ${detected} s before`, () => {
      const { rig, mark, tickAt, sendAt } = exactRig(hidden);
      sendAt(48_000, play("song"));
      const end = (rig.scheduledUntil() ?? 0) + 3 * BAR;
      const lookahead = Math.round((hidden ? BACKGROUND_LOOKAHEAD_SECONDS : LOOKAHEAD_SECONDS) * 48_000);
      let frame = 48_000;
      for (frame += 1_200; frame + lookahead <= end && frame < end - detected * 48_000; frame += 1_200) tickAt(frame);
      tickAt(end - detected * 48_000);
      expect(rig.scheduledUntil()).toBeNull();
      const playFrame = end - command * 48_000;
      if (hidden) sendAt(playFrame - 10, { kind: "background", isHidden: false });
      sendAt(playFrame, play("song"));
      expect(rig.lastFrame).toBe(playFrame);
      for (frame = playFrame + 1_200; frame < end + BAR; frame += 1_200) tickAt(frame);
      expect(expectSameMusic(rig, mark, rig.finish())).toBeGreaterThan(0);
    });
  }
  it("replays a load of parameters only in that window with no immediate point", () => {
    const { rig, mark, tickAt, sendAt } = exactRig(false);
    sendAt(48_000, play("song"));
    const end = (rig.scheduledUntil() ?? 0) + 3 * BAR;
    for (let frame = 49_200; frame + 5_760 <= end; frame += 1_200) tickAt(frame);
    tickAt(end - 4_800);
    const loadFrame = end - 2_400;
    sendAt(loadFrame, load("quieter kick"));
    sendAt(loadFrame + 1_200, play("loop"));
    for (let frame = end; frame < end + BAR; frame += 1_200) tickAt(frame);
    expect(rig.log.items.some((item) => item.kind === "point" && item.frame === loadFrame + 128)).toBe(false);
    expect(expectSameMusic(rig, mark, rig.finish())).toBeGreaterThan(0);
  });
});

describe("the replay of chosen moments", () => {
  it("enters a structural change one quantum before the bar on the same bar as live", () => {
    const { rig, mark, tickAt, sendAt } = exactRig(false, "kick and hat");
    sendAt(48_000, play("loop"));
    const start = rig.scheduledUntil() ?? 0;
    const boundary = start + Math.floor((2 * 240 * 48_000) / 132);
    for (let frame = 49_200; frame + 5_760 < boundary - 64; frame += 1_200) tickAt(frame);
    tickAt(boundary - 64 - 5_760);
    expect(rig.scheduledUntil()).toBe(boundary - 64);
    sendAt(boundary - 64 - 5_000, load("with a bass"));
    for (let frame = boundary - 3_000; frame < boundary + 2 * 48_000; frame += 1_200) tickAt(frame);
    const activations = rig.log.items.filter((item) => item.kind === "activation").map((item) => item.frame);
    expect(activations).toContain(boundary);
    expect(expectSameMusic(rig, mark, rig.finish())).toBeGreaterThan(0);
  });
  it("schedules no further than live did when a change comes after a late tick's horizon and a stop follows", () => {
    const { rig, mark, tickAt, sendAt } = exactRig(false, "kick and hat");
    sendAt(48_000, play("loop"));
    const start = rig.scheduledUntil() ?? 0;
    const boundary = start + Math.floor((2 * 240 * 48_000) / 132);
    for (let frame = 49_200; frame + 5_760 < boundary - 128; frame += 1_200) tickAt(frame);
    tickAt(boundary - 128 - 5_760);
    // The worker's timer is late: the load and the stop come after everything scheduled.
    sendAt(boundary + 1_000, load("with a bass"));
    sendAt(boundary + 1_100, { kind: "stop" });
    sendAt(boundary + 2_000, play("loop"));
    for (let frame = boundary + 3_200; frame < boundary + 2 * 48_000; frame += 1_200) tickAt(frame);
    expect(expectSameMusic(rig, mark, rig.finish())).toBeGreaterThan(0);
  });
  it("plays a range of the song as live did", () => {
    const { rig, mark, tickAt, sendAt } = exactRig(false);
    sendAt(48_000, { kind: "range", change: { mode: "song", range: { startBar: 2, endBar: 3, cycle: true }, locate: false } });
    sendAt(48_100, play("song"));
    for (let frame = 49_200; frame < 48_000 * 12; frame += 1_200) tickAt(frame);
    expect(expectSameMusic(rig, mark, rig.finish())).toBeGreaterThan(0);
  });
});

describe("TransportHost receipts and the TakeRecorder", () => {
  it("accepts every receipt of an arm and a reaffirmation with a worklet report going back between them", () => {
    const rig = new LiveRig(48_000, true);
    rig.report();
    rig.send(load("kick and hat"));
    rig.send(play("loop"));
    for (let tick = 1; tick <= 10; tick += 1) rig.tickAt(1_000 + tick * 30);
    rig.record();
    const backwards: boolean[] = [];
    const reaffirmation: SentCommand[] = [
      { kind: "arm" },
      { kind: "background", isHidden: false },
      load("kick and hat"),
      { kind: "range", change: { mode: "loop", range: null, locate: false } },
      { kind: "range", change: { mode: "song", range: null, locate: false } },
      { kind: "stop" },
      play("loop"),
    ];
    for (const command of reaffirmation) {
      const late = rig.frame - 2_048;
      backwards.push(rig.lastFrame !== null && late < rig.lastFrame);
      rig.report(late);
      rig.send(command);
    }
    expect(backwards.some(Boolean)).toBe(true);
    expect(rig.outcomes).toEqual(reaffirmation.map(() => "recorded"));
    expect(rig.recorder?.firstSoundFrame()).not.toBeNull();
  });
});
