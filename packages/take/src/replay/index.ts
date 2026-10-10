// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The replay of a take, loaded only by renderers: the export worker's take
// chunk and the simulator.
export {
  REPLAY_AHEAD_SECONDS,
  type Materialize,
  type ReplayClock,
  type ReplayPreview,
  type ReplayTransport,
  type TakeReplayParts,
} from "./replay-ports";
export { TakeReplay, TakeReplayError, type TakeReplayErrorCode } from "./take-replay";
export { rescalingPreviewSink, rescalingSink } from "./rescaling-sink";
export { memoizedMaterialize } from "./memoized-materialize";
export {
  takeTimeline,
  type TakeTimeline,
  type TakeTimelineParts,
  type TimelineContext,
  type TimelineStart,
} from "./take-timeline";
