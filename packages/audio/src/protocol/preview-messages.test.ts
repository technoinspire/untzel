// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ActivatedTrack, ParameterPoint, ScheduledEvent } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { WorkletEventSink } from "../worker/worklet-event-sink";
import type { WorkerToMainMessage, WorkerToWorkletMessage } from "./messages";
import { UNKNOWN_INSTRUMENT_ID, previewMessages, unpackBatch } from "./index";

const INSTRUMENTS = ["bass", "hat", "kick"];
const TRACK: ActivatedTrack = {
  name: "preview",
  instrument: "bass",
  parameters: [0.5, 1],
  effects: [2],
  modulators: [],
  isMuted: false,
  isAudible: true,
};
const EVENT: ScheduledEvent = {
  frame: 6144,
  durationFrames: 1200,
  generation: -1,
  trackIndex: 0,
  value: { kind: "note", midi: 48, writtenMidi: 48 },
  velocity: 0.8,
  source: { from: 0, to: 1 },
};
const POINT: ParameterPoint = { frame: 6144, generation: -1, trackIndex: 0, parameter: 0, value: 0.7, rampFrames: 960, isConstant: true };

class RecordingTarget<Message> {
  readonly sent: { message: Message; transfer: ArrayBuffer[] }[] = [];
  postMessage(message: Message, transfer: ArrayBuffer[]): void {
    this.sent.push({ message, transfer });
  }
}

describe("previewMessages", () => {
  it("creates the preview slot with the track's instrumentId", () => {
    expect(previewMessages({ kind: "started", track: TRACK, atFrame: 4096 }, INSTRUMENTS)).toEqual([
      { type: "preview", atFrame: 4096, track: { name: "preview", instrumentId: 0, parameters: [0.5, 1], effects: [2], modulators: [] } },
    ]);
    const unknown = previewMessages({ kind: "started", track: { ...TRACK, instrument: "none" }, atFrame: 0 }, INSTRUMENTS);
    expect(unknown[0]?.type === "preview" && unknown[0].track.instrumentId).toBe(UNKNOWN_INSTRUMENT_ID);
  });
  it("packs the slot's events and points into one batch", () => {
    const [message] = previewMessages({ kind: "scheduled", events: [EVENT], points: [POINT] }, INSTRUMENTS);
    if (message?.type !== "batch") throw new Error("not a batch");
    const unpacked = unpackBatch(message.data);
    expect(unpacked.events).toEqual([{ frame: 6144, durationFrames: 1200, generation: -1, trackIndex: 0, note: 48, velocity: 0.8 }]);
    expect(unpacked.points).toEqual([{ frame: 6144, generation: -1, trackIndex: 0, parameter: 0, value: 0.7, rampFrames: 960 }]);
  });
  it("stops the slot at the frame", () => {
    expect(previewMessages({ kind: "ended", atFrame: 9000 }, INSTRUMENTS)).toEqual([{ type: "previewStop", atFrame: 9000 }]);
  });
  it("is what the live sink posts to the worklet, a batch transferred", () => {
    const worklet = new RecordingTarget<WorkerToWorkletMessage>();
    const main = new RecordingTarget<WorkerToMainMessage>();
    const sink = new WorkletEventSink(worklet, main, INSTRUMENTS);
    sink.previewStarted(TRACK, 4096);
    sink.previewScheduled([EVENT], [POINT]);
    sink.previewEnded(9000);
    expect(worklet.sent.map(({ message }) => message)).toEqual([
      ...previewMessages({ kind: "started", track: TRACK, atFrame: 4096 }, INSTRUMENTS),
      ...previewMessages({ kind: "scheduled", events: [EVENT], points: [POINT] }, INSTRUMENTS),
      ...previewMessages({ kind: "ended", atFrame: 9000 }, INSTRUMENTS),
    ]);
    expect(worklet.sent.map(({ transfer }) => transfer.length)).toEqual([0, 1, 0]);
    expect(main.sent.map(({ message }) => message)).toEqual([{ type: "previewEnded" }]);
  });
});
