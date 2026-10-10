// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every frame field of the schedule is listed here, per type: a new field fails to
// compile until it says whether the sinks rescale it.
import type {
  ActivatedModulator,
  ActivatedTrack,
  EventSink,
  ParameterPoint,
  PlaybackPosition,
  PreviewSink,
  ProgramActivation,
  ScheduledBatch,
  ScheduledEvent,
  TempoChange,
} from "@untzel/session";
import { describe, expect, it } from "vitest";
import { rescalingPreviewSink, rescalingSink } from "./rescaling-sink";

type Mapping = "scaled" | "kept";
type Lfo = Extract<ActivatedModulator, { kind: "lfo" }>;
type Envelope = Extract<ActivatedModulator, { kind: "envelope" }>;

const EVENT = { frame: "scaled", durationFrames: "scaled", generation: "kept", trackIndex: "kept", value: "kept", velocity: "kept", source: "kept" } satisfies Record<keyof ScheduledEvent, Mapping>;
const POINT = { frame: "scaled", rampFrames: "scaled", generation: "kept", trackIndex: "kept", parameter: "kept", value: "kept", isConstant: "kept" } satisfies Record<keyof ParameterPoint, Mapping>;
const POSITION = {
  frame: "scaled",
  framesPerBar: "scaled",
  bar: "kept",
  patternBar: "kept",
  loopBar: "kept",
  loopBars: "kept",
  mode: "kept",
  partIndex: "kept",
  section: "kept",
  barInPart: "kept",
  totalBars: "kept",
} satisfies Record<keyof PlaybackPosition, Mapping>;
const ACTIVATION = { atFrame: "scaled", generation: "kept", tracks: "kept", lightSourceHash: "kept", stagePlanHash: "kept" } satisfies Record<keyof ProgramActivation, Mapping>;
const TRACK = { modulators: "kept", name: "kept", instrument: "kept", parameters: "kept", effects: "kept", isMuted: "kept", isAudible: "kept" } satisfies Record<keyof ActivatedTrack, Mapping>;
const LFO = { periodFrames: "scaled", originFrame: "scaled", kind: "kept", index: "kept", shape: "kept", curve: "kept", low: "kept", high: "kept" } satisfies Record<keyof Lfo, Mapping>;
const ENVELOPE = { kind: "kept", index: "kept", curve: "kept", seconds: "kept", low: "kept", high: "kept" } satisfies Record<keyof Envelope, Mapping>;
const TEMPO = { atFrame: "scaled", bpm: "kept" } satisfies Record<keyof TempoChange, Mapping>;

const FROM = 44_100;
const TO = 48_000;
const FRAME = 44_101;
const SCALED = Math.round((FRAME * TO) / FROM);

const event: ScheduledEvent = { frame: FRAME, durationFrames: FRAME, generation: 3, trackIndex: 1, value: { kind: "hit", accent: false }, velocity: 0.8, source: { from: 1, to: 2 } };
const point: ParameterPoint = { frame: FRAME, rampFrames: FRAME, generation: 3, trackIndex: 1, parameter: 0, value: 0.5, isConstant: true };
const position: PlaybackPosition = { frame: FRAME, framesPerBar: FRAME, bar: 2, patternBar: 2, loopBar: 2, loopBars: 4, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null };
const lfo: Lfo = { kind: "lfo", index: 0, shape: 1, curve: 0, periodFrames: FRAME, originFrame: FRAME, low: 0, high: 1 };
const envelope: Envelope = { kind: "envelope", index: 1, curve: 1, seconds: 0.25, low: 0, high: 1 };
const track: ActivatedTrack = { name: "kick", instrument: "kick", parameters: [1, 0], effects: [], modulators: [lfo, envelope], isMuted: false, isAudible: true };
const activation: ProgramActivation = { generation: 3, atFrame: FRAME, tracks: [track], lightSourceHash: 7, stagePlanHash: 8 };

/** Every field marked scaled moved to the new rate; every other field is the same. */
function expectMapped<Value extends object>(before: Value, after: Value, mapping: Record<keyof Value, Mapping>): void {
  for (const key of Object.keys(mapping) as (keyof Value)[]) {
    if (mapping[key] === "scaled") expect(after[key]).toBe(SCALED);
    else if (key !== "tracks" && key !== "modulators") expect(after[key]).toEqual(before[key]);
  }
}

class Recorded implements EventSink, PreviewSink {
  readonly calls: unknown[][] = [];
  deliver(batch: ScheduledBatch): void {
    this.calls.push(["deliver", batch]);
  }
  programChanged(change: ProgramActivation): void {
    this.calls.push(["programChanged", change]);
  }
  tempoChanged(change: TempoChange): void {
    this.calls.push(["tempoChanged", change]);
  }
  stopped(atFrame: number): void {
    this.calls.push(["stopped", atFrame]);
  }
  ended(atFrame: number): void {
    this.calls.push(["ended", atFrame]);
  }
  previewStarted(started: ActivatedTrack, atFrame: number): void {
    this.calls.push(["previewStarted", started, atFrame]);
  }
  previewScheduled(events: readonly ScheduledEvent[], points: readonly ParameterPoint[]): void {
    this.calls.push(["previewScheduled", events, points]);
  }
  previewEnded(atFrame: number): void {
    this.calls.push(["previewEnded", atFrame]);
  }
}

function expectTrack(after: ActivatedTrack): void {
  expectMapped(track, after, TRACK);
  const [movedLfo, keptEnvelope] = after.modulators;
  expectMapped(lfo, movedLfo as Lfo, LFO);
  expectMapped(envelope, keptEnvelope as Envelope, ENVELOPE);
}

describe("rescalingSink", () => {
  it("moves every frame field of the schedule to the new rate", () => {
    const target = new Recorded();
    const sink = rescalingSink(target, FROM, TO);
    sink.deliver({ events: [event], parameters: [point], position });
    sink.programChanged(activation);
    sink.tempoChanged({ bpm: 132, atFrame: FRAME });
    sink.stopped(FRAME);
    sink.ended(FRAME);
    const [deliver, changed, tempo, stopped, ended] = target.calls;
    const batch = deliver?.[1] as ScheduledBatch;
    expectMapped(event, batch.events[0] as ScheduledEvent, EVENT);
    expectMapped(point, batch.parameters[0] as ParameterPoint, POINT);
    expectMapped(position, batch.position, POSITION);
    const moved = changed?.[1] as ProgramActivation;
    expectMapped(activation, moved, ACTIVATION);
    expectTrack(moved.tracks[0] as ActivatedTrack);
    expectMapped({ bpm: 132, atFrame: FRAME }, tempo?.[1] as TempoChange, TEMPO);
    expect(stopped).toEqual(["stopped", SCALED]);
    expect(ended).toEqual(["ended", SCALED]);
  });
  it("is the sink itself at the same rate", () => {
    const target = new Recorded();
    expect(rescalingSink(target, TO, TO)).toBe(target);
    expect(rescalingPreviewSink(target, TO, TO)).toBe(target);
  });
});

describe("rescalingPreviewSink", () => {
  it("moves the audition's frames to the new rate", () => {
    const target = new Recorded();
    const sink = rescalingPreviewSink(target, FROM, TO);
    sink.previewStarted(track, FRAME);
    sink.previewScheduled([event], [point]);
    sink.previewEnded(FRAME);
    const [started, scheduled, ended] = target.calls;
    expectTrack(started?.[1] as ActivatedTrack);
    expect(started?.[2]).toBe(SCALED);
    expectMapped(event, (scheduled?.[1] as ScheduledEvent[])[0] as ScheduledEvent, EVENT);
    expectMapped(point, (scheduled?.[2] as ParameterPoint[])[0] as ParameterPoint, POINT);
    expect(ended).toEqual(["previewEnded", SCALED]);
  });
});
