// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PostSettings } from "../safety/post-light";
import type { ScenePrimitive } from "../composer/scene-primitive";
// What the frame driver hands a renderer. WebGL2 draws the scene with every pass
// (SDF figures, area light, trail, bloom, tone map); the 2D level is the fallback when
// WebGL2 is missing, the scene alone, and the music never stops either way.

export type RendererKind = "webgl2" | "2d";

/**
 * The 2D context calls the renderers make. Built from the canvas mixins that both the DOM
 * and the WebWorker libs declare, so the export worker type-checks the same renderers
 * without the DOM (CanvasRenderingContext2D does not exist there).
 */
export type StageContext2D = CanvasCompositing &
  CanvasDrawPath &
  CanvasFillStrokeStyles &
  CanvasPathDrawingStyles &
  CanvasPath &
  CanvasRect &
  CanvasTransform;

/** The page draws on an element; the export on an OffscreenCanvas in a worker. Both fit. */
export interface StageCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d", options?: { alpha?: boolean }): StageContext2D | null;
  getContext(contextId: "webgl2", options?: WebGLContextAttributes): WebGL2RenderingContext | null;
}

/** A box in stage-height units (origin at the centre, y down). */
export interface StageBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** The regions that stay dark, already on this stage. */
export interface StageMask {
  readonly boxes: readonly StageBox[];
  /** Nothing above this y; null in a file, which has no chrome to keep dark. */
  readonly topY: number | null;
  /** Soft edge of the mask, stage-height units. */
  readonly feather: number;
}

/** The sky's haze above the chrome line, in a frame without chrome (an exported file). */
export interface DrawnAtmosphere {
  /** Stage-height units: the chrome line; the haze rises from SKY_OVERLAP_U under it. */
  readonly lineY: number;
  /** The haze's level with the beat's breath on it. */
  readonly level: number;
  readonly color: number;
  readonly flow: number;
}

export interface DrawnFrame {
  /** Placed on the stage: stage-height units. */
  readonly primitives: readonly ScenePrimitive[];
  /** Null on the page: its top bar covers that band. */
  readonly atmosphere: DrawnAtmosphere | null;
  /** 8 slots × linear RGB. */
  readonly palette: Float32Array;
  /** Stage-height units per u: what the shaders measure flow and profiles in. */
  readonly unit: number;
  readonly mask: StageMask;
}

/** How the trail moves between two steps, about the core. */
export interface TrailWarp {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
  readonly turn: number;
  readonly decay: number;
}

export interface StageRenderer {
  readonly kind: RendererKind;
  /** Pixel size of the drawing buffer. */
  resize(width: number, height: number): void;
  /** One step of the feedback grid: F(n) = max(S(t_n), d · warp(F(n − 1))). */
  stepTrail(frame: DrawnFrame, warp: TrailWarp): void;
  clearTrail(): void;
  /** The visible frame: max(scene, d · warp(trail)), bloom, tone map, gain, mask. */
  present(frame: DrawnFrame, warp: TrailWarp | null, post: PostSettings): void;
  destroy(): void;
}

/** #0B0B0C, the stage's own colour, in linear light. */
export const STAGE_LINEAR = [0.00335, 0.00335, 0.00368] as const;
