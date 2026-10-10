// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
export type { AudibilityChange, HeardClock, LightCue, LightPort, LightProgram, LightTimeline, SceneStills, StageMode, ToneMotion } from "./ports";
export { latencyCompensatedClock } from "./stage/clock";
export {
  DEFAULT_LIMITER,
  FlashLimiter,
  contrastRatio,
  isSaturatedRed,
  relativeLuminance,
  type FlashLimiterOptions,
  type FrameLuminance,
} from "./safety/flash-limiter";
export { FRAME_BUDGET_MS, FrameBudget, type FrameQuality } from "./stage/frame-budget";
export type { RendererKind, StageCanvas } from "./renderers/renderer";
export { MAX_DEVICE_PIXEL_RATIO, createStage, type Stage, type StageOptions } from "./stage/stage";
export { DESIGN_RADIUS, SAFE_MARGIN, fitScene, placeOnStage, sceneSquare, stageToSquare, type SceneFit, type SceneSquare, type StageSize } from "./composer/scene-fit";
export { LightCueMapper, type MappedBatch } from "./cues/cue-mapper";
export { buildLightProgram, type ProgramSource, type ProgramTrack } from "./cues/light-program";
export { createOfflineStage, type OfflineStage, type OfflineStageOptions } from "./stage/offline-stage";
export { deliverActivation, deliverBatch, type LightSink } from "./cues/light-delivery";
