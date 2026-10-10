// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Pure point measurements of one sound for the b.1 targets: the level of a partial
// against the fundamental (the harmonic profile, a long Hann-windowed DFT from
// 0.05 to 1 s) and the swing of the short-term RMS (the supersaw's beating). No DOM, no
// WASM: a mono buffer and a sample rate in, numbers out.

const PARTIAL_FROM_SECONDS = 0.05;
const PARTIAL_TO_SECONDS = 1;
/** A partial is searched this fraction around its nominal frequency (inharmonicity). */
const PARTIAL_TOLERANCE = 0.03;

/** Hann-windowed DFT magnitude of `segment` at `hz` (rotating phasor, no trig per sample). */
export function magnitudeAt(segment: Float32Array, sampleRate: number, hz: number): number {
  const n = segment.length;
  if (n === 0) return 0;
  const w = (2 * Math.PI * hz) / sampleRate;
  const stepRe = Math.cos(w);
  const stepIm = -Math.sin(w);
  const wn = (2 * Math.PI) / n;
  const windowRe = Math.cos(wn);
  const windowIm = Math.sin(wn);
  let oscRe = 1;
  let oscIm = 0;
  let winRe = 1;
  let winIm = 0;
  let re = 0;
  let im = 0;
  for (let i = 0; i < n; i += 1) {
    const value = (segment[i] ?? 0) * (0.5 - 0.5 * winRe);
    re += value * oscRe;
    im += value * oscIm;
    const nextRe = oscRe * stepRe - oscIm * stepIm;
    oscIm = oscRe * stepIm + oscIm * stepRe;
    oscRe = nextRe;
    const nextWin = winRe * windowRe - winIm * windowIm;
    winIm = winRe * windowIm + winIm * windowRe;
    winRe = nextWin;
  }
  return Math.sqrt(re * re + im * im);
}

/** Strongest magnitude within ±tolerance of `hz`, in steps of a quarter DFT bin. */
export function peakMagnitudeNear(segment: Float32Array, sampleRate: number, hz: number, tolerance: number): number {
  const step = sampleRate / segment.length / 4;
  let best = 0;
  for (let f = hz * (1 - tolerance); f <= hz * (1 + tolerance); f += step) best = Math.max(best, magnitudeAt(segment, sampleRate, f));
  return best;
}

const db = (ratio: number): number => (ratio <= 0 ? -Infinity : 20 * Math.log10(ratio));

/** Level in dB of each partial `ratio × f0` relative to the fundamental. */
export function partialLevelsDb(samples: Float32Array, sampleRate: number, f0: number, ratios: readonly number[]): number[] {
  const from = Math.round(PARTIAL_FROM_SECONDS * sampleRate);
  const to = Math.min(samples.length, Math.round(PARTIAL_TO_SECONDS * sampleRate));
  const segment = samples.subarray(from, Math.max(from, to));
  const fundamental = peakMagnitudeNear(segment, sampleRate, f0, PARTIAL_TOLERANCE);
  return ratios.map((ratio) => db(peakMagnitudeNear(segment, sampleRate, f0 * ratio, PARTIAL_TOLERANCE) / fundamental));
}

/** Highest minus lowest 50 ms RMS (dB) between `fromSeconds` and `toSeconds`. */
export function rmsSwingDb(samples: Float32Array, sampleRate: number, fromSeconds: number, toSeconds: number): number {
  const window = Math.round(0.05 * sampleRate);
  const end = Math.min(samples.length, Math.round(toSeconds * sampleRate));
  let low = Infinity;
  let high = -Infinity;
  for (let start = Math.round(fromSeconds * sampleRate); start + window <= end; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i += 1) sum += (samples[i] ?? 0) ** 2;
    const level = 10 * Math.log10(sum / window + 1e-20);
    low = Math.min(low, level);
    high = Math.max(high, level);
  }
  return high >= low ? high - low : 0;
}
