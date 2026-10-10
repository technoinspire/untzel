// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { MASK_ELLIPSE_SCALE as ELLIPSE_SCALE, SKY_OVERLAP_U } from "../mask-shape";
import { MAX_MASK_BOXES } from "../pack";
import { STAGE_LINEAR } from "../renderer";
import { FLOW_NOISE_GLSL } from "../../composer/flow-noise";
import { DRIFT_GLSL, STAGE_POSITION_GLSL } from "./area-shader";
// The passes after the scene (THIRD_PARTY.md). The trail warps and fades the last
// frame under the new one, the Butterchurn technique, with max instead of a sum. The bloom
// is the dual filter (Marius Bjørge, SIGGRAPH 2015): a chain of half-resolution levels,
// 4 taps on the way down and an 8-tap tent on the way up, implemented by us. The final
// pass tone-maps without shifting the hue, applies the limiter's gain to the whole image
// and keeps the brand zones and the top chrome dark.

const WARP_GLSL = `
uniform vec2 u_resolution;
uniform vec4 u_warp; // centre x, centre y (stage-height units), zoom, turn
${STAGE_POSITION_GLSL}
vec2 warped(vec2 uv) {
  vec2 p = stagePosition(uv, u_resolution);
  vec2 centre = u_warp.xy;
  float c = cos(u_warp.w), s = sin(u_warp.w);
  vec2 d = (p - centre) / u_warp.z;
  vec2 source = centre + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  return vec2(source.x * u_resolution.y / u_resolution.x + 0.5, 0.5 - source.y);
}`;

/** F(n) = max(S(t_n), d · warp(F(n − 1))). */
export const TRAIL_STEP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_trail;
uniform float u_decay;
out vec4 outColor;
${WARP_GLSL}
void main() {
  vec3 previous = u_decay * texture(u_trail, warped(v_uv)).rgb;
  outColor = vec4(max(texture(u_scene, v_uv).rgb, previous), 1.0);
}`;

/** display(t) = max(S(t), d · warp(F(m))); without a trail, u_decay is 0. */
export const COMPOSE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_trail;
uniform float u_decay;
out vec4 outColor;
${WARP_GLSL}
void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 trail = u_decay > 0.0 ? u_decay * texture(u_trail, warped(v_uv)).rgb : vec3(0.0);
  outColor = vec4(max(scene, trail), 1.0);
}`;

export const BLOOM_DOWN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
out vec4 outColor;
void main() {
  vec2 o = u_texel * 0.5;
  vec3 sum = texture(u_source, v_uv).rgb * 4.0;
  sum += texture(u_source, v_uv - o).rgb;
  sum += texture(u_source, v_uv + o).rgb;
  sum += texture(u_source, v_uv + vec2(o.x, -o.y)).rgb;
  sum += texture(u_source, v_uv + vec2(-o.x, o.y)).rgb;
  outColor = vec4(sum / 8.0, 1.0);
}`;

export const BLOOM_UP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_base;
uniform vec2 u_texel;
out vec4 outColor;
void main() {
  vec2 o = u_texel * 0.5;
  vec3 sum = texture(u_source, v_uv + vec2(-o.x * 2.0, 0.0)).rgb;
  sum += texture(u_source, v_uv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture(u_source, v_uv + vec2(0.0, o.y * 2.0)).rgb;
  sum += texture(u_source, v_uv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture(u_source, v_uv + vec2(o.x * 2.0, 0.0)).rgb;
  sum += texture(u_source, v_uv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture(u_source, v_uv + vec2(0.0, -o.y * 2.0)).rgb;
  sum += texture(u_source, v_uv + vec2(-o.x, -o.y)).rgb * 2.0;
  outColor = vec4(sum / 12.0 + texture(u_base, v_uv).rgb, 1.0);
}`;

/** The sky haze's own noise seed, apart from every track's. */
const SKY_HAZE_SEED = 0x5ce7;

const vec3 = (rgb: readonly number[]): string => `vec3(${rgb.map((value) => value.toFixed(5)).join(", ")})`;

export const FINAL_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_display;
uniform sampler2D u_bloom;
uniform vec2 u_resolution;
uniform float u_bloomIntensity;
uniform float u_gain;
uniform vec4 u_mask[${MAX_MASK_BOXES + 1}];
uniform vec4 u_sky; // level, colour slot, line y (stage-height units), flow; level 0: none
uniform vec3 u_palette[8];
uniform float u_unit;
out vec4 outColor;
${STAGE_POSITION_GLSL}
${FLOW_NOISE_GLSL}
${DRIFT_GLSL}
const vec3 STAGE = ${vec3(STAGE_LINEAR)};
const float KNEE = 0.7;
const uint SKY_HAZE_SEED = ${SKY_HAZE_SEED}u;
// u: the haze is full at the chrome line and fades out SKY_OVERLAP under it, so the light
// runs through the line without a dark seam (a file has no top mask); above, it thins.
const float SKY_OVERLAP = ${SKY_OVERLAP_U.toFixed(3)};
const float SKY_THIN = 1.6;
float encode(float c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
/**
 * The brand zones' darkness alone, 1 outside them. Each zone is dark inside the ellipse
 * through its corners and fades over the feather, measured as a distance (the ellipse's
 * value over its gradient): no straight edge, so the zone never reads as a box.
 */
float brandKeep(vec2 p) {
  float feather = u_mask[${MAX_MASK_BOXES}].y;
  float keep = 1.0;
  int count = int(u_mask[${MAX_MASK_BOXES}].z + 0.5);
  for (int i = 0; i < ${MAX_MASK_BOXES}; i++) {
    if (i >= count) break;
    vec4 box = u_mask[i];
    vec2 radii = (box.zw - box.xy) * ${ELLIPSE_SCALE.toFixed(6)};
    vec2 q = (p - (box.xy + box.zw) * 0.5) / radii;
    float r = length(q);
    float slope = length(q / radii) / max(r, 1e-6);
    keep *= smoothstep(0.0, feather, (r - 1.0) / max(slope, 1e-6));
  }
  return keep;
}
float darkness(vec2 p) {
  float feather = u_mask[${MAX_MASK_BOXES}].y;
  // The top band's edge stays tight: the sky starts 0.02 u under it. A file's mask puts the
  // line far above the frame (pack.ts), so only the page masks its chrome band.
  return smoothstep(u_mask[${MAX_MASK_BOXES}].x, u_mask[${MAX_MASK_BOXES}].x + feather * 0.15, p.y) * brandKeep(p);
}
/**
 * A file's sky above the chrome line: a file has no top mask, so the
 * scene's own light and this haze run through the line together. It rises from
 * SKY_OVERLAP under the line to full at the line, then thins upwards (1/e at SKY_THIN),
 * textured by the bands' drift. u_sky.x already carries the beat's breath.
 */
float skyHaze(vec2 p) {
  float above = (u_sky.z - p.y) / u_unit;
  if (u_sky.x <= 0.0 || above <= -SKY_OVERLAP) return 0.0;
  float rise = smoothstep(-SKY_OVERLAP, 0.0, above);
  float thin = exp(-max(0.0, above) / SKY_THIN);
  return u_sky.x * rise * thin * drift(p, u_sky.w, SKY_HAZE_SEED);
}
void main() {
  vec3 light = texture(u_display, v_uv).rgb + u_bloomIntensity * texture(u_bloom, v_uv).rgb;
  vec2 p = stagePosition(v_uv, u_resolution);
  light = (light * darkness(p) + u_palette[int(u_sky.y + 0.5)] * skyHaze(p) * brandKeep(p)) * u_gain;
  vec3 color = STAGE + light;
  // Hue-preserving soft knee on the largest channel: linear up to KNEE, then an exponential
  // shoulder towards 1. Dividing by the peak alone flattened every overlap into one pastel
  // plateau; the shoulder keeps a gradient inside the brightest light.
  float peak = max(color.r, max(color.g, color.b));
  if (peak > KNEE) color *= (KNEE + (1.0 - KNEE) * (1.0 - exp(-(peak - KNEE) / (1.0 - KNEE)))) / peak;
  outColor = vec4(encode(color.r), encode(color.g), encode(color.b), 1.0);
}`;
