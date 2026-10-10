// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A take's plan. The simulator reaches it by its own entry
// (@untzel/export/take-plan); the page through the index, which re-exports it.
import { SAMPLE_RATE, exportCapSeconds, framePlan, type ExportRequest, type PlanResult } from "./plan";

/** Under a second there is nothing to make a file of (the take's MIN_TAKE_SECONDS; export does not import take). */
const MIN_TAKE_SECONDS = 1;

/**
 * A take's stretch in seconds, cut at the format's cap: the only place of that cut (RF9).
 * The rest is the program's: frames, card, WAV tail, size and bitrate; no origin.
 */
export function planTake(takeSeconds: number, request: Pick<ExportRequest, "format" | "quality">, reducedMotion: boolean): PlanResult {
  const cap = exportCapSeconds(request.format, request.quality);
  if (!(takeSeconds >= MIN_TAKE_SECONDS)) return { ok: false, reason: "EMPTY_RANGE", maxSeconds: cap };
  const musicFrames = Math.round(Math.min(takeSeconds, cap) * SAMPLE_RATE);
  return { ok: true, plan: framePlan(request, musicFrames, { kind: "take", isCut: takeSeconds > cap }, reducedMotion, "") };
}
