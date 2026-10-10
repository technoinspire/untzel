// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { FLOW_NOISE_GLSL } from "../../composer/flow-noise";
import { FIGURE_GAIN } from "../../safety/post-light";
// Figures as instanced quads, each evaluating its shape's signed distance per pixel
// (THIRD_PARTY.md). The distances (ring, segment, box, the arc mask, the ellipse's
// first-order estimate) are written by us after Inigo Quilez's "2D distance functions"
// article; the edge is anti-aliased over one pixel, so a ring is sharp at 4K. Lengths are
// in stage-height units; u_unit turns them into composition units where a curve needs it.

export const FIGURE_VERTEX = `#version 300 es
precision highp float;
in vec2 a_corner;
in vec4 a_shape;   // kind, x, y, size
in vec4 a_light;   // width, intensity, color, extra
in vec4 a_form;    // whiteCore, aspect, rotation, flow
in float a_seed;
uniform vec2 u_resolution;
uniform float u_halfWidth;
out vec2 v_local;
out vec2 v_corner;
flat out vec4 v_shape;
flat out vec4 v_light;
flat out vec4 v_form;
flat out float v_seed;
void main() {
  int kind = int(a_shape.x + 0.5);
  float size = a_shape.w;
  float width = max(a_light.x, 0.0015);
  float aspect = a_form.y;
  float glow = width * 7.0 + 0.012;
  vec2 extent;
  if (kind == 9 || kind == 10) {
    extent = vec2(u_halfWidth + 0.02, abs(size) + glow + 0.02);
  } else {
    float reach = size;
    if (kind == 3) reach = size * 0.5;
    if (kind == 5) reach = size * 1.42;
    if (kind == 6) reach = size * 1.2;
    if (kind == 7) reach = size * max(1.0, aspect);
    if (kind == 8) reach = size * max(1.0, aspect) * 1.42;
    if (kind == 4) reach = size * 2.5;
    extent = vec2(reach + glow);
  }
  vec2 centre = kind == 9 || kind == 10 ? vec2(0.0, a_shape.z) : a_shape.yz;
  vec2 world = centre + a_corner * extent;
  v_local = world - a_shape.yz;
  v_corner = a_corner;
  v_shape = a_shape;
  v_light = a_light;
  v_form = a_form;
  v_seed = a_seed;
  vec2 clip = vec2(world.x * 2.0 * u_resolution.y / u_resolution.x, -world.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

export const FIGURE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
in vec2 v_corner;
flat in vec4 v_shape;
flat in vec4 v_light;
flat in vec4 v_form;
flat in float v_seed;
uniform vec3 u_palette[8];
uniform float u_pixel;
uniform float u_unit;
uniform float u_halfWidth;
out vec4 outColor;
${FLOW_NOISE_GLSL}
const float TAU = 6.283185307;
vec2 turn(vec2 p, float angle) { float c = cos(angle), s = sin(angle); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
float segment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float box(vec2 p, vec2 halfSize) { vec2 d = abs(p) - halfSize; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float ring(vec2 q, float radius, float upper) {
  float d = abs(length(q) - radius);
  if (upper > 0.5 && q.y > 0.0) d = min(length(q - vec2(radius, 0.0)), length(q + vec2(radius, 0.0)));
  return d;
}
float ellipseRing(vec2 q, vec2 radii) {
  float k = length(q / radii);
  vec2 g = q / (radii * radii);
  return abs(k - 1.0) * k / max(length(g), 1e-5);
}
float arcs(vec2 q, float radius, float count, float rotation) {
  float angle = atan(q.y, q.x) - rotation;
  float span = TAU / max(count, 1.0);
  float local = mod(angle, span) - span * 0.5;
  float gap = (abs(local) - span * 0.3) * radius;
  return max(abs(length(q) - radius), gap);
}
float shards(vec2 q, float inner, float outer, float count, float rotation) {
  float angle = atan(q.y, q.x) - rotation;
  float span = TAU / max(count, 1.0);
  float local = mod(angle + span * 0.5, span) - span * 0.5;
  vec2 spoke = length(q) * vec2(cos(local), sin(local));
  return segment(spoke, vec2(inner, 0.0), vec2(outer, 0.0));
}
float lineShape(float x, float shape, float phase, float frequency, float flow, uint seed) {
  if (shape < 0.5) return 0.0;
  if (shape < 1.5) return sin(x * 4.0 * frequency + phase);
  if (shape < 2.5) return 2.0 * fract(x * 1.6 * frequency + phase / TAU) - 1.0;
  if (shape < 3.5) return (mod(floor(x * 3.0 * frequency + phase), 3.0) - 1.0);
  return 0.72 * sin(x * 3.2 * frequency + phase) + 0.28 * flowNoise(vec2(x * 1.4, 0.37), flow, seed);
}
float distanceOf(int kind, vec2 q, float size, float width, float aspect, float rotation, float extra, float flow, uint seed) {
  if (kind == 0) return ring(q, size, extra) - width * 0.5;
  if (kind == 1) return arcs(q, size, extra, rotation) - width * 0.5;
  if (kind == 2) return shards(q, size * aspect, size, extra, rotation) - width * 0.5;
  if (kind == 3) return segment(q, vec2(0.0, -size * 0.5), vec2(0.0, size * 0.5)) - width * 0.5;
  if (kind == 4) return length(q) - size;
  if (kind == 5) return abs(box(turn(q, rotation), vec2(size))) - width * 0.5;
  if (kind == 6) return min(segment(q, vec2(-size * 0.45, -size * 0.5), vec2(-size * 0.45, size * 0.5)), segment(q, vec2(size * 0.45, -size * 0.5), vec2(size * 0.45, size * 0.5))) - width * 0.5;
  if (kind == 7) return ellipseRing(q, vec2(size, size * aspect)) - width * 0.5;
  if (kind == 8) return box(turn(q, rotation), vec2(size, size * aspect)) - width * 0.5;
  float x = q.x / u_unit;
  if (kind == 9) {
    float h = 0.002;
    float y0 = size * lineShape(x, extra, rotation, aspect, flow, seed);
    float y1 = size * lineShape(x + h, extra, rotation, aspect, flow, seed);
    float slope = (y1 - y0) / (h * u_unit);
    return abs(q.y - y0) / sqrt(1.0 + slope * slope) - width * 0.5;
  }
  float tooth = (mod(x, 0.06) - 0.03) * u_unit;
  return segment(vec2(tooth, q.y), vec2(0.0, 0.0), vec2(0.0, -size)) - width * 0.5;
}
void main() {
  int kind = int(v_shape.x + 0.5);
  float width = max(v_light.x, 0.0015);
  float d = distanceOf(kind, v_local, v_shape.w, width, v_form.y, v_form.z, v_light.w, v_form.w, uint(v_seed));
  float core = clamp(0.5 - d / u_pixel, 0.0, 1.0);
  // The halo reaches 0 before the quad's edge, so no figure shows its box.
  float edge = 1.0 - smoothstep(0.6, 1.0, max(abs(v_corner.x), abs(v_corner.y)));
  float halo = exp(-max(d, 0.0) / (width * 2.2 + u_pixel * 2.0)) * edge;
  float light = ${FIGURE_GAIN.toFixed(3)} * core + 0.45 * halo;
  if (kind == 9 || kind == 10) {
    float worldX = abs(v_local.x);
    light *= 1.0 - smoothstep(u_halfWidth - 0.06, u_halfWidth, worldX);
  }
  vec3 tint = u_palette[int(v_light.z + 0.5)];
  vec3 color = mix(tint, vec3(1.0), v_form.x * core * 0.85);
  outColor = vec4(color * light * v_light.y, 1.0);
}`;
