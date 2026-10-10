// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { FLOW_NOISE_GLSL } from "../composer/flow-noise";
import { linkProgram } from "../renderers/webgl2/gl-resources";
// Test build only (@untzel/light/testing): the flow noise evaluated by the shader the
// renderer uses, one point per pixel of a 1 × n float target, read back, so the browser
// test compares the GPU with the CPU vectors of flow-noise.test.ts.

export interface NoisePoint {
  readonly x: number;
  readonly y: number;
  readonly time: number;
  readonly seed: number;
}

const VERTEX = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

function fragment(points: readonly NoisePoint[]): string {
  const cases = points
    .map((point, index) => `  if (column == ${index}) value = flowNoise(vec2(${point.x.toFixed(9)}, ${point.y.toFixed(9)}), ${point.time.toFixed(9)}, ${point.seed >>> 0}u);`)
    .join("\n");
  return `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
${FLOW_NOISE_GLSL}
void main() {
  int column = int(gl_FragCoord.x);
  float value = 0.0;
${cases}
  outColor = vec4(value, 0.0, 0.0, 1.0);
}`;
}

/** The GLSL flow noise at each point, or null without WebGL2 float render targets. */
export function flowNoiseOnGpu(points: readonly NoisePoint[]): readonly number[] | null {
  const canvas = new OffscreenCanvas(points.length, 1);
  const gl = canvas.getContext("webgl2");
  if (gl === null || gl.getExtension("EXT_color_buffer_float") === null) return null;
  const program = linkProgram(gl, VERTEX, fragment(points));
  if (program === null) return null;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, points.length, 1, 0, gl.RGBA, gl.FLOAT, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, points.length, 1);
  gl.useProgram(program.program);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const pixels = new Float32Array(points.length * 4);
  gl.readPixels(0, 0, points.length, 1, gl.RGBA, gl.FLOAT, pixels);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return points.map((_, index) => pixels[index * 4] ?? Number.NaN);
}
