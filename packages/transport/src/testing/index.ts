// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Test doubles of the transport ports. Exported by @untzel/transport/testing; the
// dependency rule "testing-only-in-tests" keeps them out of production code.
import type { ClockPort, EventSink } from "../ports";
import type { ProgramActivation, ScheduledBatch, ScheduledEvent, TempoChange } from "../types";

export type { ManualClock, Tickable } from "./drive";
export { driveClock } from "./drive";
export type { FakeProgramOptions, FakeTrackOptions } from "./programs";
export { fakeCompiler, fakeProgram, fakeSection, fakeTrack, hitsSpec } from "./programs";

/** Clock moved by hand. nowFrame is null until the first set. */
export class FakeClock implements ClockPort {
  readonly sampleRate: number;
  #frame: number | null = null;
  #staleness = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  set(frame: number, staleness = 0): void {
    this.#frame = frame;
    this.#staleness = staleness;
  }

  advance(frames: number): void {
    this.#frame = (this.#frame ?? 0) + frames;
  }

  nowFrame(): number | null {
    return this.#frame;
  }

  staleness(): number {
    return this.#staleness;
  }
}

/** Records every call, in order. */
export class FakeEventSink implements EventSink {
  readonly batches: ScheduledBatch[] = [];
  readonly activations: ProgramActivation[] = [];
  readonly tempoChanges: TempoChange[] = [];
  readonly stops: number[] = [];
  readonly ends: number[] = [];

  deliver(batch: ScheduledBatch): void {
    this.batches.push(batch);
  }

  /** Every delivered event, in delivery order. */
  events(): ScheduledEvent[] {
    return this.batches.flatMap((batch) => batch.events);
  }

  programChanged(change: ProgramActivation): void {
    this.activations.push(change);
  }

  tempoChanged(change: TempoChange): void {
    this.tempoChanges.push(change);
  }

  stopped(atFrame: number): void {
    this.stops.push(atFrame);
  }

  ended(atFrame: number): void {
    this.ends.push(atFrame);
  }
}
