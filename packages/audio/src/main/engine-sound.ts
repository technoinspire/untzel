// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { PreviewPort, ProgramActivation, ScheduledBatch, SoundPort, Unsubscribe } from "@untzel/session";
import type { EngineStats, SamplePackData, VoiceBudget, WorkletToMainMessage } from "../protocol";
import type { CommandWatchPort } from "./command-watch";

/**
 * One scheduled batch for the light engine (LightPort feed). A frame f sounds
 * at AudioContext time f / sampleRate and reaches the speaker outputLatency later.
 */
export interface ScheduledFeed {
  readonly batch: ScheduledBatch;
  readonly sampleRate: number;
  /** Seconds; context.outputLatency, or baseLatency where the browser lacks it. */
  readonly outputLatency: number;
}

/** The worklet's answer to a sample pack: its notes play it from atFrame; null when refused. */
export type SamplesLoaded = Extract<WorkletToMainMessage, { readonly type: "samplePack" }>;

/**
 * What the composition uses of the engine's sound: the worklet port live, and any other
 * port that runs the same transport host.
 */
export interface EngineSound extends SoundPort, PreviewPort, CommandWatchPort {
  /** Every batch the worker scheduled, with what the light engine needs to sync. */
  onScheduled(listener: (feed: ScheduledFeed) => void): Unsubscribe;
  /** Every program activation, so a batch's (generation, trackIndex) can be named. */
  onActivation(listener: (activation: ProgramActivation) => void): Unsubscribe;
  /** Worklet and transport counters, every 250 ms while running. */
  onStats(listener: (stats: EngineStats) => void): Unsubscribe;
  /** Each program handed to the transport. */
  onLoad(listener: (program: Program) => void): Unsubscribe;
  /** The worklet took (or refused) a sample pack. */
  onSamplesLoaded(listener: (loaded: SamplesLoaded) => void): Unsubscribe;
  sendSamples(pack: SamplePackData): void;
  setVoiceBudget(budget: VoiceBudget): void;
  /** The page is hidden or visible again. */
  setBackground(isHidden: boolean): void;
  dispose(): void;
}
