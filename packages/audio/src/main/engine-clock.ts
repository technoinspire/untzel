// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** The engine's output clock: what every reader of musical time on the page uses. */
export interface EngineClock {
  readonly sampleRate: number;
  /** The output frame now; null until the output runs. */
  nowFrame(): number | null;
  /** The output clock in seconds (AudioContext.currentTime, live). */
  seconds(): number;
  /** When the sound now leaving the speaker was rendered; satisfies the light's HeardClock. */
  heardTime(): number;
}

/** What contextClock reads of an AudioContext. */
export interface ContextClockSource {
  readonly sampleRate: number;
  readonly state: AudioContextState;
  readonly currentTime: number;
  readonly outputLatency?: number;
  readonly baseLatency?: number;
  getOutputTimestamp?(): AudioTimestamp;
}

/**
 * Live: the AudioContext. heardTime maps getOutputTimestamp() to this moment's
 * performance.now(), and falls back to currentTime minus the reported latencies.
 */
export function contextClock(context: ContextClockSource, now: () => number = () => performance.now()): EngineClock {
  return {
    sampleRate: context.sampleRate,
    nowFrame: () => (context.state === "running" ? Math.round(context.currentTime * context.sampleRate) : null),
    seconds: () => context.currentTime,
    heardTime() {
      const stamp = context.getOutputTimestamp?.();
      if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
        return stamp.contextTime + (now() - stamp.performanceTime) / 1000;
      }
      return context.currentTime - (context.outputLatency ?? 0) - (context.baseLatency ?? 0);
    },
  };
}
