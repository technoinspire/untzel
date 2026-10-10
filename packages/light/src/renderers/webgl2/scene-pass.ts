// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { MAX_AREAS, MAX_PRIMITIVES } from "../../composer/scene-primitive";
import { FLOATS_PER_FIGURE, VEC4_PER_AREA, packAreas, packFigures } from "../pack";
import type { DrawnFrame } from "../renderer";
import { AREA_FRAGMENT, COPY_FRAGMENT, FULLSCREEN_VERTEX } from "./area-shader";
import { FIGURE_FRAGMENT, FIGURE_VERTEX } from "./figure-shader";
import { bindTarget, bindTexture, linkProgram, type GlProgram, type RenderTarget } from "./gl-resources";
// The scene S(t) into a target: the area light first, one full-screen pass into a target at
// half the resolution (the light is soft, so a bilinear upsample is the same picture at a
// quarter of the cost: 2.3 s of a 7.1 s story at 1080 × 1920, measured 04/10/2026), copied
// up, then the figures as instanced quads at full resolution, added with ONE, ONE.

export interface ScenePass {
  /** `areas` is a scratch target at half of `target`'s size. */
  draw(frame: DrawnFrame, target: RenderTarget, areas: RenderTarget): void;
  /** The full-screen triangle's vertex array, shared with the post passes. */
  readonly fullscreen: WebGLVertexArrayObject;
  destroy(): void;
}

const ATTRIBUTES = [
  ["a_shape", 4, 0],
  ["a_light", 4, 4],
  ["a_form", 4, 8],
  ["a_seed", 1, 12],
] as const;

export function createScenePass(gl: WebGL2RenderingContext): ScenePass | null {
  const figures = linkProgram(gl, FIGURE_VERTEX, FIGURE_FRAGMENT);
  const areas = linkProgram(gl, FULLSCREEN_VERTEX, AREA_FRAGMENT);
  const copy = linkProgram(gl, FULLSCREEN_VERTEX, COPY_FRAGMENT);
  if (figures === null || areas === null || copy === null) return null;
  const fullscreen = fullscreenTriangle(gl, areas);
  const instanced = instancedQuads(gl, figures);
  const figureData = new Float32Array(MAX_PRIMITIVES * FLOATS_PER_FIGURE);
  const areaData = new Float32Array(MAX_AREAS * VEC4_PER_AREA * 4);
  return {
    fullscreen,
    draw(frame, target, areaTarget) {
      const hasAreas = drawAreas(gl, areas, fullscreen, frame, areaTarget, areaData);
      bindTarget(gl, target, target.width, target.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (hasAreas) copyUp(gl, copy, fullscreen, areaTarget);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      drawFigures(gl, figures, instanced, frame, target, figureData);
      gl.disable(gl.BLEND);
    },
    destroy() {
      gl.deleteProgram(figures.program);
      gl.deleteProgram(areas.program);
      gl.deleteProgram(copy.program);
      gl.deleteVertexArray(fullscreen);
      gl.deleteVertexArray(instanced.vao);
      gl.deleteBuffer(instanced.instances);
    },
  };
}

function setShared(gl: WebGL2RenderingContext, program: GlProgram, frame: DrawnFrame, target: RenderTarget): void {
  gl.uniform2f(program.uniform("u_resolution"), target.width, target.height);
  gl.uniform1f(program.uniform("u_unit"), frame.unit);
  gl.uniform1f(program.uniform("u_halfWidth"), target.width / target.height / 2);
  gl.uniform3fv(program.uniform("u_palette"), frame.palette);
}

/** The area light alone into its half-resolution target; false when there is none. */
function drawAreas(gl: WebGL2RenderingContext, program: GlProgram, vao: WebGLVertexArrayObject, frame: DrawnFrame, target: RenderTarget, data: Float32Array): boolean {
  const count = packAreas(frame.primitives, data);
  if (count === 0) return false;
  bindTarget(gl, target, target.width, target.height);
  gl.useProgram(program.program);
  setShared(gl, program, frame, target);
  gl.uniform1i(program.uniform("u_count"), count);
  gl.uniform4fv(program.uniform("u_areas"), data);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return true;
}

/** The half-resolution area light into the bound full-resolution target, bilinear. */
function copyUp(gl: WebGL2RenderingContext, program: GlProgram, vao: WebGLVertexArrayObject, areas: RenderTarget): void {
  gl.useProgram(program.program);
  bindTexture(gl, program, "u_source", 0, areas.texture);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function drawFigures(
  gl: WebGL2RenderingContext,
  program: GlProgram,
  instanced: { readonly vao: WebGLVertexArrayObject; readonly instances: WebGLBuffer },
  frame: DrawnFrame,
  target: RenderTarget,
  data: Float32Array,
): void {
  const count = packFigures(frame.primitives, data);
  if (count === 0) return;
  gl.useProgram(program.program);
  setShared(gl, program, frame, target);
  gl.uniform1f(program.uniform("u_pixel"), 1.2 / target.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, instanced.instances);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * FLOATS_PER_FIGURE);
  gl.bindVertexArray(instanced.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
}

function fullscreenTriangle(gl: WebGL2RenderingContext, program: GlProgram): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program.program, "a_position");
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

function instancedQuads(gl: WebGL2RenderingContext, program: GlProgram): { readonly vao: WebGLVertexArrayObject; readonly instances: WebGLBuffer } {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program.program, "a_corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_PRIMITIVES * FLOATS_PER_FIGURE * 4, gl.DYNAMIC_DRAW);
  for (const [name, size, offset] of ATTRIBUTES) {
    const location = gl.getAttribLocation(program.program, name);
    if (location < 0) continue;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, FLOATS_PER_FIGURE * 4, offset * 4);
    gl.vertexAttribDivisor(location, 1);
  }
  gl.bindVertexArray(null);
  return { vao, instances };
}
