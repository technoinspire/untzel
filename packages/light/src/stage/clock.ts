// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { HeardClock } from "../ports";

/**
 * lightTime = event.audioTime + outputLatency. Comparing a cue
 * against (contextTime − latency) is the same test, and keeps cues in audio time.
 */
export function latencyCompensatedClock(contextTime: () => number, outputLatency: () => number): HeardClock {
  return { heardTime: () => contextTime() - outputLatency() };
}
