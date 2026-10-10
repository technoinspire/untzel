// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { KeepOut } from "@untzel/scene";
import { Composer } from "../composer/composer";
import { EXPORT_PRE_ROLL_S } from "../composer/feedback-schedule";
import { FrameDriver } from "./frame-driver";
import type { LightPort } from "../ports";
import { createCanvas2DRenderer } from "../renderers/canvas2d";
import type { StageRenderer } from "../renderers/renderer";
import { createWebGL2Renderer } from "../renderers/webgl2/webgl2";
// The stage without DOM or clock, for the export: the caller says which instant
// to draw. The same composer, frame driver, trail grid, limiter clock and WebGL2 renderer as
// the live stage, at the file's own size: the video is what the screen shows. The trail is
// rolled for a second before the first frame, so frame 0 carries the music's own light.

export interface OfflineStageOptions {
  readonly canvas: OffscreenCanvas;
  readonly reducedMotion: boolean;
  readonly keepOut: KeepOut;
  /** "webgl2" first, "2d" when that context fails. */
  readonly prefer?: "webgl2" | "2d";
}

export interface OfflineStage extends Omit<LightPort, "setMode"> {
  readonly kind: "webgl2" | "2d";
  /** Draws the instant `heardTime` (seconds of audio time) on the canvas. */
  drawAt(heardTime: number): void;
  destroy(): void;
}

/** Null when neither WebGL2 nor 2D gives a context. */
export function createOfflineStage(options: OfflineStageOptions): OfflineStage | null {
  const renderer = pickRenderer(options.canvas, options.prefer ?? "webgl2");
  if (renderer === null) return null;
  renderer.resize(options.canvas.width, options.canvas.height);
  const composer = new Composer();
  const driver = new FrameDriver({ composer, renderer, keepOut: options.keepOut, isReduced: options.reducedMotion, preRoll: EXPORT_PRE_ROLL_S });
  const size = { width: options.canvas.width, height: options.canvas.height };
  return {
    kind: renderer.kind,
    setProgram: (program) => composer.setProgram(program),
    setAudibility: (change) => composer.setAudibility(change),
    schedule: (cues, timeline) => composer.schedule(cues, timeline),
    drawAt: (heardTime) => void driver.drawAt(heardTime, size),
    destroy: () => renderer.destroy(),
  };
}

function pickRenderer(canvas: OffscreenCanvas, prefer: "webgl2" | "2d"): StageRenderer | null {
  if (prefer === "webgl2") {
    const webgl = createWebGL2Renderer(canvas, (message) => console.info(message));
    if (webgl !== null) return webgl;
  }
  return createCanvas2DRenderer(canvas);
}
