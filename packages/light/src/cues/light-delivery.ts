// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { MappedBatch } from "./cue-mapper";
import type { AudibilityChange, LightPort, LightProgram } from "../ports";
// What the mapper returns, handed to a light port: the live page's relay and the export's
// offline stage wire the mapper the same way through these two functions.

export type LightSink = Pick<LightPort, "setProgram" | "setAudibility" | "schedule">;

export function deliverActivation(sink: LightSink, result: LightProgram | AudibilityChange | null): void {
  if (result === null) return;
  if ("scenes" in result) sink.setProgram(result);
  else sink.setAudibility(result);
}

export function deliverBatch(sink: LightSink, mapped: MappedBatch): void {
  for (const change of mapped.audibility) sink.setAudibility(change);
  sink.schedule(mapped.cues, mapped.timeline);
}
