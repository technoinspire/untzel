// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// @untzel/light/offline: the stage for the export worker. Nothing reachable from here
// names a DOM type (no element, no AudioContext clock), so a program compiled with the
// WebWorker lib alone type-checks it. The live stage stays in the main entry.
export type { AudibilityChange, LightCue, LightProgram, LightTimeline } from "./ports";
export { LightCueMapper, type MappedBatch } from "./cues/cue-mapper";
export { buildLightProgram, type ProgramSource, type ProgramTrack } from "./cues/light-program";
export { DESIGN_RADIUS, SAFE_MARGIN, fitScene, sceneSquare, stageToSquare, type SceneFit, type SceneSquare, type StageSize } from "./composer/scene-fit";
export { createOfflineStage, type OfflineStage, type OfflineStageOptions } from "./stage/offline-stage";
export { deliverActivation, deliverBatch, type LightSink } from "./cues/light-delivery";
