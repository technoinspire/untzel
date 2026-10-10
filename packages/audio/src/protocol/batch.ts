// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Batch layout for the worklet, one Float64Array (transferred):
//
//   header (2 f64): eventCount, pointCount
//   event  (6 f64): frame, durationFrames, generation, trackIndex, note, velocity
//   point  (6 f64): frame, generation, trackIndex, parameter, value, rampFrames
//
//   hit   -> note = HIT_NOTE (drum voices ignore it); velocity = event velocity
//   note  -> note = midi
//   chord -> one event per midi, same frame, duration and velocity
import type { EventValue } from "@untzel/core";
import type { ParameterPoint, ScheduledBatch, ScheduledEvent } from "@untzel/session";

export const BATCH_HEADER_LENGTH = 2;
export const BATCH_EVENT_STRIDE = 6;
export const BATCH_POINT_STRIDE = 6;
export const HIT_NOTE = -1;

export interface PackedEvent {
  readonly frame: number;
  readonly durationFrames: number;
  readonly generation: number;
  readonly trackIndex: number;
  /** midi, or HIT_NOTE. */
  readonly note: number;
  readonly velocity: number;
}

/** What the worklet reads of a point: whether it was a constant is the light's concern only. */
export type PackedPoint = Omit<ParameterPoint, "isConstant">;
export interface UnpackedBatch {
  readonly events: readonly PackedEvent[];
  readonly points: readonly PackedPoint[];
}

function notesOf(value: EventValue): readonly number[] {
  switch (value.kind) {
    case "hit":
      return [HIT_NOTE];
    case "note":
      return [value.midi];
    case "chord":
      return value.midis;
  }
}

function packedEventCount(events: readonly ScheduledEvent[]): number {
  let count = 0;
  for (const event of events) count += notesOf(event.value).length;
  return count;
}

/** Events and points of a batch (the position is not packed: the worklet does not need it). */
export function packBatch(batch: Pick<ScheduledBatch, "events" | "parameters">): Float64Array<ArrayBuffer> {
  const eventCount = packedEventCount(batch.events);
  const pointCount = batch.parameters.length;
  const data = new Float64Array(
    BATCH_HEADER_LENGTH + eventCount * BATCH_EVENT_STRIDE + pointCount * BATCH_POINT_STRIDE,
  );
  data[0] = eventCount;
  data[1] = pointCount;
  let offset = BATCH_HEADER_LENGTH;
  for (const event of batch.events) {
    for (const note of notesOf(event.value)) {
      data.set(
        [event.frame, event.durationFrames, event.generation, event.trackIndex, note, event.velocity],
        offset,
      );
      offset += BATCH_EVENT_STRIDE;
    }
  }
  for (const point of batch.parameters) {
    data.set(
      [point.frame, point.generation, point.trackIndex, point.parameter, point.value, point.rampFrames],
      offset,
    );
    offset += BATCH_POINT_STRIDE;
  }
  return data;
}

/** Throws a RangeError when the header does not match the length: a protocol defect. */
export function unpackBatch(data: Float64Array): UnpackedBatch {
  const eventCount = data[0] ?? 0;
  const pointCount = data[1] ?? 0;
  const expected =
    BATCH_HEADER_LENGTH + eventCount * BATCH_EVENT_STRIDE + pointCount * BATCH_POINT_STRIDE;
  if (data.length !== expected) {
    throw new RangeError(`Batch of ${data.length} cells, header says ${expected}`);
  }
  const cell = (index: number): number => data[index] ?? 0;
  const events: PackedEvent[] = [];
  let offset = BATCH_HEADER_LENGTH;
  for (let i = 0; i < eventCount; i += 1, offset += BATCH_EVENT_STRIDE) {
    events.push({
      frame: cell(offset),
      durationFrames: cell(offset + 1),
      generation: cell(offset + 2),
      trackIndex: cell(offset + 3),
      note: cell(offset + 4),
      velocity: cell(offset + 5),
    });
  }
  const points: PackedPoint[] = [];
  for (let i = 0; i < pointCount; i += 1, offset += BATCH_POINT_STRIDE) {
    points.push({
      frame: cell(offset),
      generation: cell(offset + 1),
      trackIndex: cell(offset + 2),
      parameter: cell(offset + 3),
      value: cell(offset + 4),
      rampFrames: cell(offset + 5),
    });
  }
  return { events, points };
}
