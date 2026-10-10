// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { BLOOM_LEVELS, type PostSettings } from "../../safety/post-light";
import { MAX_MASK_BOXES, packMask } from "../pack";
import type { DrawnFrame, TrailWarp } from "../renderer";
import { FULLSCREEN_VERTEX } from "./area-shader";
import { bindTarget, bindTexture, linkProgram, type GlProgram, type RenderTarget } from "./gl-resources";
import { BLOOM_DOWN_FRAGMENT, BLOOM_UP_FRAGMENT, COMPOSE_FRAGMENT, FINAL_FRAGMENT, TRAIL_STEP_FRAGMENT } from "./post-shaders";
// The post passes as calls: a trail step, the display (scene max trail), the bloom chain
// and the final image on the canvas.

export interface PostPrograms {
  readonly trail: GlProgram;
  readonly compose: GlProgram;
  readonly down: GlProgram;
  readonly up: GlProgram;
  readonly final: GlProgram;
}

export function createPostPrograms(gl: WebGL2RenderingContext): PostPrograms | null {
  const trail = linkProgram(gl, FULLSCREEN_VERTEX, TRAIL_STEP_FRAGMENT);
  const compose = linkProgram(gl, FULLSCREEN_VERTEX, COMPOSE_FRAGMENT);
  const down = linkProgram(gl, FULLSCREEN_VERTEX, BLOOM_DOWN_FRAGMENT);
  const up = linkProgram(gl, FULLSCREEN_VERTEX, BLOOM_UP_FRAGMENT);
  const final = linkProgram(gl, FULLSCREEN_VERTEX, FINAL_FRAGMENT);
  if (trail === null || compose === null || down === null || up === null || final === null) return null;
  return { trail, compose, down, up, final };
}

export function deletePostPrograms(gl: WebGL2RenderingContext, programs: PostPrograms): void {
  for (const program of Object.values(programs)) gl.deleteProgram(program.program);
}

function setWarp(gl: WebGL2RenderingContext, program: GlProgram, target: RenderTarget, warp: TrailWarp | null): void {
  gl.uniform2f(program.uniform("u_resolution"), target.width, target.height);
  gl.uniform4f(program.uniform("u_warp"), warp?.centerX ?? 0, warp?.centerY ?? 0, warp?.zoom ?? 1, warp?.turn ?? 0);
  gl.uniform1f(program.uniform("u_decay"), warp?.decay ?? 0);
}

/** next = max(scene, d · warp(previous)), at the trail's resolution. */
export function runTrailStep(gl: WebGL2RenderingContext, programs: PostPrograms, vao: WebGLVertexArrayObject, scene: RenderTarget, previous: RenderTarget, next: RenderTarget, warp: TrailWarp): void {
  bindTarget(gl, next, next.width, next.height);
  gl.useProgram(programs.trail.program);
  setWarp(gl, programs.trail, next, warp);
  bindTexture(gl, programs.trail, "u_scene", 0, scene.texture);
  bindTexture(gl, programs.trail, "u_trail", 1, previous.texture);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function runCompose(gl: WebGL2RenderingContext, programs: PostPrograms, vao: WebGLVertexArrayObject, scene: RenderTarget, trail: RenderTarget, display: RenderTarget, warp: TrailWarp | null): void {
  bindTarget(gl, display, display.width, display.height);
  gl.useProgram(programs.compose.program);
  setWarp(gl, programs.compose, display, warp);
  bindTexture(gl, programs.compose, "u_scene", 0, scene.texture);
  bindTexture(gl, programs.compose, "u_trail", 1, trail.texture);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Down the chain with 4 taps, back up with the 8-tap tent; levels[0] ends as the bloom. */
export function runBloom(gl: WebGL2RenderingContext, programs: PostPrograms, vao: WebGLVertexArrayObject, source: RenderTarget, down: readonly RenderTarget[], up: readonly RenderTarget[]): RenderTarget | null {
  gl.bindVertexArray(vao);
  let from = source;
  gl.useProgram(programs.down.program);
  for (const level of down) {
    bindTarget(gl, level, level.width, level.height);
    gl.uniform2f(programs.down.uniform("u_texel"), 1 / from.width, 1 / from.height);
    bindTexture(gl, programs.down, "u_source", 0, from.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    from = level;
  }
  gl.useProgram(programs.up.program);
  for (let index = BLOOM_LEVELS - 2; index >= 0; index -= 1) {
    const target = up[index];
    const base = down[index];
    if (target === undefined || base === undefined) return null;
    bindTarget(gl, target, target.width, target.height);
    gl.uniform2f(programs.up.uniform("u_texel"), 1 / from.width, 1 / from.height);
    bindTexture(gl, programs.up, "u_source", 0, from.texture);
    bindTexture(gl, programs.up, "u_base", 1, base.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    from = target;
  }
  return from;
}

export function runFinal(
  gl: WebGL2RenderingContext,
  programs: PostPrograms,
  vao: WebGLVertexArrayObject,
  canvas: { readonly width: number; readonly height: number },
  display: RenderTarget,
  bloom: RenderTarget,
  post: PostSettings,
  frame: DrawnFrame,
  maskData: Float32Array,
): void {
  bindTarget(gl, null, canvas.width, canvas.height);
  const { final } = programs;
  gl.useProgram(final.program);
  gl.uniform2f(final.uniform("u_resolution"), canvas.width, canvas.height);
  gl.uniform1f(final.uniform("u_bloomIntensity"), post.bloom);
  gl.uniform1f(final.uniform("u_gain"), post.outputGain);
  packMask(frame.mask, maskData);
  const sky = frame.atmosphere;
  gl.uniform4f(final.uniform("u_sky"), sky?.level ?? 0, sky?.color ?? 0, sky?.lineY ?? 0, sky?.flow ?? 0);
  gl.uniform3fv(final.uniform("u_palette"), frame.palette);
  gl.uniform1f(final.uniform("u_unit"), frame.unit);
  gl.uniform4fv(final.uniform("u_mask"), maskData);
  bindTexture(gl, final, "u_display", 0, display.texture);
  bindTexture(gl, final, "u_bloom", 1, bloom.texture);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export const MASK_FLOATS = (MAX_MASK_BOXES + 1) * 4;
