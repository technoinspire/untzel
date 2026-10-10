// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { BLOOM_LEVELS, type PostSettings } from "../../safety/post-light";
import type { DrawnFrame, StageCanvas, StageRenderer, TrailWarp } from "../renderer";
import { createTarget, deleteTarget, type RenderTarget } from "./gl-resources";
import { MASK_FLOATS, createPostPrograms, deletePostPrograms, runBloom, runCompose, runFinal, runTrailStep } from "./post-pass";
import { createScenePass } from "./scene-pass";
// The WebGL2 stage: the scene in SDF figures and area light, the feedback trail
// on its audio-time grid, the dual-filter bloom, the hue-preserving tone map and the
// limiter's gain on the final image. The live page and the export worker run this same
// renderer, so the video is the screen.

/** The area light's resolution over its target's: soft light, a quarter of the pixels. */
const AREA_SCALE = 0.5;

interface Targets {
  readonly scene: RenderTarget;
  /** The area light at half of the scene's resolution, and of the trail step's. */
  readonly sceneAreas: RenderTarget;
  readonly display: RenderTarget;
  readonly stepScene: RenderTarget;
  readonly stepAreas: RenderTarget;
  trail: RenderTarget;
  spare: RenderTarget;
  readonly down: readonly RenderTarget[];
  readonly up: readonly RenderTarget[];
  readonly bufferScale: number;
}

// Over 40 lines: the WebGL2 renderer; its passes share the context, the programs and the render targets, every frame.
export function createWebGL2Renderer(canvas: StageCanvas, onInfo: (message: string) => void = () => undefined): StageRenderer | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
  if (gl === null) return null;
  const isHalfFloat = gl.getExtension("EXT_color_buffer_float") !== null;
  if (!isHalfFloat) onInfo("stage: no 16-bit render target; the trail and bloom use 8 bits");
  const scenePass = createScenePass(gl);
  const programs = createPostPrograms(gl);
  if (scenePass === null || programs === null) return null;
  const maskData = new Float32Array(MASK_FLOATS);
  let targets: Targets | null = null;
  const build = (bufferScale: number): Targets => {
    if (targets !== null) release(gl, targets);
    const { width, height } = canvas;
    const sized = (scale: number): RenderTarget => createTarget(gl, width * scale, height * scale, isHalfFloat);
    const levels = Array.from({ length: BLOOM_LEVELS }, (_, index) => bufferScale / 2 ** index);
    targets = {
      scene: sized(1),
      sceneAreas: sized(AREA_SCALE),
      display: sized(1),
      stepScene: sized(bufferScale),
      stepAreas: sized(bufferScale * AREA_SCALE),
      trail: sized(bufferScale),
      spare: sized(bufferScale),
      down: levels.map((scale) => sized(scale)),
      up: levels.slice(0, -1).map((scale) => sized(scale)),
      bufferScale,
    };
    return targets;
  };
  const ready = (bufferScale: number): Targets => (targets !== null && targets.bufferScale === bufferScale ? targets : build(bufferScale));
  return {
    kind: "webgl2",
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      build(targets?.bufferScale ?? 0.5);
    },
    stepTrail(frame, warp) {
      const current = ready(targets?.bufferScale ?? 0.5);
      scenePass.draw(frame, current.stepScene, current.stepAreas);
      runTrailStep(gl, programs, scenePass.fullscreen, current.stepScene, current.trail, current.spare, warp);
      [current.trail, current.spare] = [current.spare, current.trail];
    },
    clearTrail() {
      if (targets === null) return;
      for (const target of [targets.trail, targets.spare]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    present(frame: DrawnFrame, warp: TrailWarp | null, post: PostSettings) {
      const current = ready(post.bufferScale);
      scenePass.draw(frame, current.scene, current.sceneAreas);
      runCompose(gl, programs, scenePass.fullscreen, current.scene, current.trail, current.display, post.hasTrail ? warp : null);
      const bloom = runBloom(gl, programs, scenePass.fullscreen, current.display, current.down, current.up) ?? current.display;
      runFinal(gl, programs, scenePass.fullscreen, canvas, current.display, bloom, { ...post, bloom: post.bloom / BLOOM_LEVELS }, frame, maskData);
    },
    destroy() {
      if (targets !== null) release(gl, targets);
      scenePass.destroy();
      deletePostPrograms(gl, programs);
    },
  };
}

function release(gl: WebGL2RenderingContext, targets: Targets): void {
  for (const target of [targets.scene, targets.sceneAreas, targets.display, targets.stepScene, targets.stepAreas, targets.trail, targets.spare, ...targets.down, ...targets.up]) deleteTarget(gl, target);
}
