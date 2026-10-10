// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Loudness after ITU-R BS.1770-4: K-weighting (a high shelf of about +4 dB from
// 1681.97 Hz and a high-pass at 38.13 Hz, coefficients computed for the sample rate),
// mean square per 400 ms block with 75% overlap, an absolute gate at −70 LUFS and a
// relative gate 10 LU below the ungated mean. Short-term loudness uses 3 s windows.
// Every channel has weight 1 (left and right; no surround here).

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_SECONDS = 0.4;
const SHORT_TERM_SECONDS = 3;
const STEP_SECONDS = 0.1;
const SILENT = -Infinity;

interface Biquad {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

/** The two K-weighting stages for `sampleRate`. */
export function kWeighting(sampleRate: number): readonly [Biquad, Biquad] {
  const shelfFrequency = 1681.974450955533;
  const shelfGainDb = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  let k = Math.tan((Math.PI * shelfFrequency) / sampleRate);
  const vh = 10 ** (shelfGainDb / 20);
  const vb = vh ** 0.4996667741545416;
  let a0 = 1 + k / shelfQ + k * k;
  const shelf: Biquad = {
    b0: (vh + (vb * k) / shelfQ + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / shelfQ + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / shelfQ + k * k) / a0,
  };
  const highpassFrequency = 38.13547087602444;
  const highpassQ = 0.5003270373238773;
  k = Math.tan((Math.PI * highpassFrequency) / sampleRate);
  a0 = 1 + k / highpassQ + k * k;
  const highpass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / highpassQ + k * k) / a0,
  };
  return [shelf, highpass];
}

function filtered(channel: ArrayLike<number>, sampleRate: number): Float64Array {
  const out = new Float64Array(channel.length);
  let input: ArrayLike<number> = channel;
  for (const { b0, b1, b2, a1, a2 } of kWeighting(sampleRate)) {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let n = 0; n < input.length; n += 1) {
      const x = input[n] ?? 0;
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[n] = y;
    }
    input = out.slice();
  }
  return out;
}

/** Sum over channels of the mean square of each window of `windowSeconds`, every 100 ms. */
function windowPowers(weighted: readonly Float64Array[], sampleRate: number, windowSeconds: number): number[] {
  const length = weighted[0]?.length ?? 0;
  const window = Math.round(windowSeconds * sampleRate);
  const step = Math.round(STEP_SECONDS * sampleRate);
  // Prefix sums of the squares make every window O(1).
  const prefix = weighted.map((channel) => {
    const sums = new Float64Array(channel.length + 1);
    for (let n = 0; n < channel.length; n += 1) sums[n + 1] = (sums[n] ?? 0) + (channel[n] ?? 0) ** 2;
    return sums;
  });
  const powers: number[] = [];
  for (let start = 0; start + window <= length; start += step) {
    let power = 0;
    for (const sums of prefix) power += ((sums[start + window] ?? 0) - (sums[start] ?? 0)) / window;
    powers.push(power);
  }
  return powers;
}

const lufsOf = (power: number): number => (power > 0 ? -0.691 + 10 * Math.log10(power) : SILENT);
const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export interface Loudness {
  /** Integrated loudness, LUFS; −Infinity for silence. */
  readonly integratedLufs: number;
  /** Largest short-term (3 s) loudness, LUFS. */
  readonly shortTermMaxLufs: number;
}

export function measureLoudness(channels: readonly ArrayLike<number>[], sampleRate: number): Loudness {
  const weighted = channels.map((channel) => filtered(channel, sampleRate));
  const blocks = windowPowers(weighted, sampleRate, BLOCK_SECONDS);
  const audible = blocks.filter((power) => lufsOf(power) > ABSOLUTE_GATE_LUFS);
  const relativeGate = lufsOf(mean(audible)) + RELATIVE_GATE_LU;
  const gated = audible.filter((power) => lufsOf(power) > relativeGate);
  const shortTerm = windowPowers(weighted, sampleRate, SHORT_TERM_SECONDS);
  return {
    integratedLufs: gated.length === 0 ? SILENT : lufsOf(mean(gated)),
    shortTermMaxLufs: shortTerm.length === 0 ? SILENT : lufsOf(Math.max(...shortTerm)),
  };
}
