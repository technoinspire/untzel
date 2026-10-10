// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type { ClockPort, EventSink } from "./ports";
export type {
  ActivatedModulator,
  ActivatedTrack,
  BeatGrid,
  ParameterPoint,
  PlaybackMode,
  PlaybackPosition,
  ProgramActivation,
  ScheduledBatch,
  ScheduledEvent,
  TempoChange,
  TransportStats,
} from "./types";
export type { PatternCompiler } from "./scheduling/compiled-program";
export type { CreatedPlayRange, PlayRange, PlayRangeChange } from "./play-range/play-range";
export { clampPlayRange, createPlayRange, isInPlayRange, isPlayRange, playFromBar, snapToBar } from "./play-range/play-range";
export { lastBarOf } from "./play-range/play-range-ruler";
export type { BarBeat, ExportStretch, StretchHandle, StretchLimits, StretchResult, TimeMap, TimeSegment } from "./export-stretch/export-stretch";
export {
  FINE_TICKS,
  MIN_STRETCH_TICKS,
  TICKS_PER_BAR,
  TICKS_PER_BEAT,
  TICKS_PER_STEP,
  barBeatLabel,
  barBeatOf,
  clampStretch,
  gridTicks,
  moveStretchHandle,
  secondsAtTick,
  stretchKeyTick,
  stretchOfPlayRange,
  stretchSeconds,
  tickAtSeconds,
  trimStretchToCap,
} from "./export-stretch/export-stretch";
export { exportTimeMap } from "./export-stretch/export-stretch-time";
export type { NextBar, RangeChange } from "./play-range/play-range-schedule";
export { barAfterRangeChange, barWithoutRange, nextRangeBar, offsetForBar } from "./play-range/play-range-schedule";
export type { RangePartNames } from "./play-range/play-range-parts";
export { extendRangeToPart, isRangeOfPart, partIndexAtBar, rangeOfPart, rangePartNames } from "./play-range/play-range-parts";
export type { PlayOptions, TransportDependencies, TransportPlayResult } from "./scheduling/transport";
export {
  LOOKAHEAD_SECONDS,
  BACKGROUND_LOOKAHEAD_SECONDS,
  PARAMETER_RAMP_SECONDS,
  PHRASE_BARS,
  STALE_AFTER_MS,
  Transport,
} from "./scheduling/transport";
export type { PreviewDependencies, PreviewSink } from "./scheduling/preview";
export { PREVIEW_GAIN, PREVIEW_GENERATION, PREVIEW_MAX_BARS, PREVIEW_TRACK, PreviewTransport } from "./scheduling/preview";
