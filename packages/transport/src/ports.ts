// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Ports the transport uses. Defined here, not in session, to keep the package graph
// acyclic; @untzel/session re-exports them for adapters.
import type { ProgramActivation, ScheduledBatch, TempoChange } from "./types";

export interface ClockPort {
  readonly sampleRate: number;
  /** Best estimate of the frame the worklet is rendering now, or null before the first report. */
  nowFrame(): number | null;
  /** Milliseconds since the last frame report; used to detect a suspended context. */
  staleness(): number;
}

export interface EventSink {
  deliver(batch: ScheduledBatch): void;
  programChanged(change: ProgramActivation): void;
  /** Every new TempoOrigin, play included. */
  tempoChanged(change: TempoChange): void;
  stopped(atFrame: number): void;
  /** A song without "| loop" reached its end. */
  ended(atFrame: number): void;
}
