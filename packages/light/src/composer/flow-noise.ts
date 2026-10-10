// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Flow noise and curl (THIRD_PARTY.md): 2D simplex noise whose gradients turn with
// time, the flow-noise idea of Stefan Gustavson's webgl-noise and psrdnoise (MIT). Ported
// as an algorithm, written by us: the lattice hash is integer multiplication only
// (Math.imul here, uint in GLSL), so the lattice is bit-identical on the CPU and the GPU,
// and FLOW_NOISE_GLSL below is the same function line by line. Pure: time comes in.

const SKEW = (Math.sqrt(3) - 1) / 2;
const UNSKEW = (3 - Math.sqrt(3)) / 6;
const SCALE = 70;
const TAU = Math.PI * 2;

/** 0..1 from a lattice point and a seed. */
export function latticeHash(i: number, j: number, seed: number): number {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function corner(dx: number, dy: number, i: number, j: number, turn: number, seed: number): number {
  const falloff = 0.5 - dx * dx - dy * dy;
  if (falloff <= 0) return 0;
  const angle = latticeHash(i, j, seed) * TAU + turn;
  const f2 = falloff * falloff;
  return f2 * f2 * (Math.cos(angle) * dx + Math.sin(angle) * dy);
}

/** −1..1. `time` turns every gradient by time × 2π: the noise flows instead of sliding. */
export function flowNoise(x: number, y: number, time: number, seed: number): number {
  const s = (x + y) * SKEW;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * UNSKEW;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + UNSKEW;
  const y1 = y0 - j1 + UNSKEW;
  const x2 = x0 - 1 + 2 * UNSKEW;
  const y2 = y0 - 1 + 2 * UNSKEW;
  const turn = time * TAU;
  return SCALE * (corner(x0, y0, i, j, turn, seed) + corner(x1, y1, i + i1, j + j1, turn, seed) + corner(x2, y2, i + 1, j + 1, turn, seed));
}

const CURL_STEP = 1e-3;

/** The curl of the noise field, (∂n/∂y, −∂n/∂x): a flow without sources or sinks. */
export function curl(x: number, y: number, time: number, seed: number): readonly [number, number] {
  const dx = (flowNoise(x + CURL_STEP, y, time, seed) - flowNoise(x - CURL_STEP, y, time, seed)) / (2 * CURL_STEP);
  const dy = (flowNoise(x, y + CURL_STEP, time, seed) - flowNoise(x, y - CURL_STEP, time, seed)) / (2 * CURL_STEP);
  return [dy, -dx];
}

/**
 * Where a particle born at (x, y) is after `age` seconds of flow: one RK2 (midpoint) step
 * of the curl field. A pure function of birth and age, so any frame rate gives the same path.
 */
export function curlAdvect(x: number, y: number, age: number, flow: number, speed: number, seed: number, frequency: number): readonly [number, number] {
  const [ax, ay] = curl(x * frequency, y * frequency, flow, seed);
  const half = (age * speed) / 2;
  const [bx, by] = curl((x + ax * half) * frequency, (y + ay * half) * frequency, flow, seed);
  return [x + bx * age * speed, y + by * age * speed];
}

/** The same noise in GLSL ES 3.0, for the area pass and the ribbons. */
export const FLOW_NOISE_GLSL = `
float latticeHash(int i, int j, uint seed) {
  uint h = (uint(i) * 374761393u + uint(j) * 668265263u) ^ seed;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h ^= h >> 16u;
  return float(h) / 4294967296.0;
}
float flowCorner(vec2 d, int i, int j, float turn, uint seed) {
  float falloff = 0.5 - dot(d, d);
  if (falloff <= 0.0) return 0.0;
  float angle = latticeHash(i, j, seed) * 6.283185307 + turn;
  float f2 = falloff * falloff;
  return f2 * f2 * dot(vec2(cos(angle), sin(angle)), d);
}
float flowNoise(vec2 p, float time, uint seed) {
  const float SKEW = 0.3660254038;
  const float UNSKEW = 0.2113248654;
  float s = (p.x + p.y) * SKEW;
  int i = int(floor(p.x + s));
  int j = int(floor(p.y + s));
  float t = float(i + j) * UNSKEW;
  vec2 d0 = p - (vec2(float(i), float(j)) - t);
  int i1 = d0.x > d0.y ? 1 : 0;
  int j1 = 1 - i1;
  vec2 d1 = d0 - vec2(float(i1), float(j1)) + UNSKEW;
  vec2 d2 = d0 - 1.0 + 2.0 * UNSKEW;
  float turn = time * 6.283185307;
  return 70.0 * (flowCorner(d0, i, j, turn, seed) + flowCorner(d1, i + i1, j + j1, turn, seed) + flowCorner(d2, i + 1, j + 1, turn, seed));
}`;
