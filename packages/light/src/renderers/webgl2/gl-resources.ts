// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The WebGL2 plumbing the passes share: programs with their uniform locations, render
// targets in half float where the device can render to it (8 bit otherwise, the same
// formula with coarser steps), and the full-screen triangle.

export interface GlProgram {
  readonly program: WebGLProgram;
  uniform(name: string): WebGLUniformLocation | null;
}

export function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): GlProgram | null {
  const program = gl.createProgram();
  const shaders: WebGLShader[] = [];
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      console.info(`stage: shader did not compile: ${gl.getShaderInfoLog(shader) ?? ""}`);
      return null;
    }
    gl.attachShader(program, shader);
    shaders.push(shader);
  }
  // One full-screen triangle serves every pass: its attribute sits at 0 in each program.
  gl.bindAttribLocation(program, 0, "a_position");
  gl.bindAttribLocation(program, 0, "a_corner");
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) return null;
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    uniform(name) {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name) ?? null;
    },
  };
}

export interface RenderTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number, isHalfFloat: boolean): RenderTarget {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (isHalfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, width: w, height: h };
}

export function deleteTarget(gl: WebGL2RenderingContext, target: RenderTarget): void {
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

/** Binds a target (or the canvas, for null) and its viewport. */
export function bindTarget(gl: WebGL2RenderingContext, target: RenderTarget | null, canvasWidth: number, canvasHeight: number): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
  gl.viewport(0, 0, target?.width ?? canvasWidth, target?.height ?? canvasHeight);
}

export function bindTexture(gl: WebGL2RenderingContext, program: GlProgram, name: string, unit: number, texture: WebGLTexture): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(program.uniform(name), unit);
}
