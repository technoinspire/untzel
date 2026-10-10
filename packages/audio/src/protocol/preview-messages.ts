// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ActivatedTrack, ParameterPoint, ScheduledEvent } from "@untzel/session";
import { toWorkletTrack } from "./activation";
import { packBatch } from "./batch";
import type { WorkerToWorkletMessage } from "./messages";

/** One call of a PreviewSink, as data. */
export type PreviewCall =
  | { readonly kind: "started"; readonly track: ActivatedTrack; readonly atFrame: number }
  | { readonly kind: "scheduled"; readonly events: readonly ScheduledEvent[]; readonly points: readonly ParameterPoint[] }
  | { readonly kind: "ended"; readonly atFrame: number };

/**
 * What the worklet receives for one audition call: the preview slot with its track, the
 * slot's batch (generation −1 inside), or the slot's stop. The same for the live worker and
 * the simulator. `instruments` are the registry names in instrumentId order.
 */
export function previewMessages(call: PreviewCall, instruments: readonly string[]): WorkerToWorkletMessage[] {
  switch (call.kind) {
    case "started":
      return [{ type: "preview", track: toWorkletTrack(call.track, instruments), atFrame: call.atFrame }];
    case "scheduled":
      return [{ type: "batch", data: packBatch({ events: call.events, parameters: call.points }) }];
    case "ended":
      return [{ type: "previewStop", atFrame: call.atFrame }];
  }
}
