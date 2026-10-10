// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { MAX_AREAS } from "../../composer/scene-primitive";
import { FLOW_NOISE_GLSL } from "../../composer/flow-noise";
import { VEC4_PER_AREA } from "../pack";

// The area light in one full-screen pass: glows, fog clouds moved by flow noise,
// bands and the ground's rising light, at most 64 per frame. Drawn as quads they would
// cover the stage 40 times; summed here, once. Every profile has compact support, so no
// light leaks into the dark regions; the bands' horizontal profile is a fixed function of
// x in u, the same in every format.

export const FULLSCREEN_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

/** A target sampled as it is, bilinear: the area light's upsample. */
export const COPY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
out vec4 outColor;
void main() { outColor = vec4(texture(u_source, v_uv).rgb, 1.0); }`;

/** Stage-height position of a pixel, origin at the centre, y down. */
export const STAGE_POSITION_GLSL = `
vec2 stagePosition(vec2 uv, vec2 resolution) {
  return vec2((uv.x - 0.5) * resolution.x / resolution.y, 0.5 - uv.y);
}`;

/** Flow-noise grain over the wide lights; reads u_unit and FLOW_NOISE_GLSL. */
export const DRIFT_GLSL = `
float drift(vec2 p, float flow, uint seed) {
  vec2 q = p / (u_unit * vec2(0.9, 0.35));
  // Mean 0.66, from about 0.26 to 1: deep enough that a band shows structure, not a flat wash.
  return 0.66 + 0.4 * (0.6 * flowNoise(q, flow, seed) + 0.4 * flowNoise(q * 2.3 + 7.1, flow * 1.7, seed + 5u));
}
`;

export const AREA_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_unit;
uniform float u_halfWidth;
uniform int u_count;
uniform vec4 u_areas[${MAX_AREAS * VEC4_PER_AREA}];
uniform vec3 u_palette[8];
out vec4 outColor;
${FLOW_NOISE_GLSL}
${STAGE_POSITION_GLSL}
vec2 turn(vec2 p, float angle) { float c = cos(angle), s = sin(angle); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
float soft(float edge0, float edge1, float x) { float t = 1.0 - smoothstep(edge0, edge1, x); return t * t; }
/** A bell with compact support: gaussian-like, exactly 0 at \`reach\`. */
float bell(float x, float reach) { float k = x / max(reach, 1e-5); return exp(-5.0 * k * k) * (1.0 - smoothstep(0.75, 1.0, k)); }
float across(float x) {
  float u = abs(x) / u_unit;
  float profile = u <= 1.25 ? 1.0 : max(0.6, 1.0 - 0.15 * (u - 1.25));
  return profile * (1.0 - smoothstep(u_halfWidth - 0.08, u_halfWidth, abs(x)));
}
float glow(vec2 q, float size, float aspect, float core) {
  float r = length(q / vec2(1.0, max(aspect, 0.05)));
  return soft(size * core, size, r);
}
float cloud(vec2 q, float size, float aspect, float flow, uint seed) {
  float light = 0.0;
  for (int lobe = 0; lobe < 4; lobe++) {
    float k = float(lobe);
    vec2 offset = vec2(flowNoise(vec2(k * 1.7, 0.3), flow, seed), flowNoise(vec2(0.4, k * 1.3 + 5.0), flow, seed)) * size * 0.38;
    vec2 base = vec2(cos(k * 1.5708 + 0.6), sin(k * 1.5708 + 0.6) * aspect) * size * 0.32;
    light = max(light, glow(q - base - offset, size * 0.62, aspect, 0.35));
  }
  float texture = 0.78 + 0.22 * flowNoise(q / (u_unit * 0.35), flow, seed + 11u);
  return light * texture;
}
${DRIFT_GLSL}
float areaLight(int kind, vec2 p, vec4 a, vec4 b, vec4 c, uint seed) {
  vec2 q = turn(p - a.yz, c.z);
  float size = a.w;
  if (kind == 0) return glow(q, size, c.y, b.x);
  if (kind == 1) return cloud(q, size, c.y, c.w, seed);
  if (kind == 2) return bell(abs(q.y), size) * across(p.x) * drift(p, c.w, seed);
  float above = a.z - p.y;
  // Continuous at the line: the light rises above it and falls, shorter, below it. The fall
  // is a square, steepest at the line, so the ground ends in a glow, not a plateau and a cut.
  float below = c.y > 0.0 ? 1.0 - clamp(-above / (c.y * u_unit), 0.0, 1.0) : 0.0;
  float light = above >= 0.0 ? 1.0 - smoothstep(0.0, size, above) : below * below;
  return light * across(p.x) * drift(p, c.w, seed);
}
void main() {
  vec2 p = stagePosition(v_uv, u_resolution);
  vec3 color = vec3(0.0);
  for (int i = 0; i < ${MAX_AREAS}; i++) {
    if (i >= u_count) break;
    vec4 a = u_areas[i * ${VEC4_PER_AREA}];
    vec4 b = u_areas[i * ${VEC4_PER_AREA} + 1];
    vec4 c = u_areas[i * ${VEC4_PER_AREA} + 2];
    vec4 d = u_areas[i * ${VEC4_PER_AREA} + 3];
    // Lengths come in stage-height units; the profiles above read them as such.
    float light = areaLight(int(a.x + 0.5), p, a, b, c, uint(d.x));
    color += u_palette[int(b.z + 0.5)] * light * b.y;
  }
  outColor = vec4(color, 1.0);
}`;
